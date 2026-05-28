/**
 * LevelFlow.ts - 关卡流程管理器
 * 管理关卡初始化、游戏进行、成功/失败的完整状态机
 *
 * 使用 NodeFactory 动态创建节点，无需手动创建预制体
 *
 * NPC分配策略：尽量均匀分配到各窗户，同窗户多NPC时
 * 依靠 WindowController 的开窗锁协调，不会同时开窗
 */
import { _decorator, Component, Node, director, Vec3 } from 'cc';
import { LevelState, GameEvent, FailReason } from '../utils/Constants';
import { LevelManager } from '../managers/LevelManager';
import { GameManager } from '../managers/GameManager';
import { AudioManager, SoundName } from '../managers/AudioManager';
import { WindowController } from './WindowController';
import { PlayerController } from './PlayerController';
import { NPCController } from './NPCController';
import { ProgressCalculator } from '../components/ProgressCalculator';
import { GameLayer } from '../layers/GameLayer';
import { ILevelConfig } from '../utils/ILevelConfig';
import { NodeFactory } from '../utils/NodeFactory';
import { DebugOverlay } from '../utils/DebugOverlay';
const { ccclass, property } = _decorator;

@ccclass('LevelFlow')
export class LevelFlow extends Component {

    /** 游戏界面 */
    @property(GameLayer)
    public gameLayer: GameLayer | null = null;

    /** 进度计算器 */
    @property(ProgressCalculator)
    public progressCalculator: ProgressCalculator | null = null;

    /** 关卡状态 */
    private _state: LevelState = LevelState.INIT;

    /** 当前关卡配置 */
    private _levelConfig: ILevelConfig | null = null;

    /** 窗户控制器列表 */
    private _windowControllers: WindowController[] = [];

    /** NPC控制器列表 */
    private _npcControllers: NPCController[] = [];

    /** 倒计时 */
    private _timeLeft: number = 60;

    /** BuildingFloor 节点 */
    private _buildingFloor: Node | null = null;

    /** 玩家节点 */
    private _playerNode: Node | null = null;

    /** 进度更新定时器 */
    private _progressTimer: number = 0;

    /** 进度更新间隔(秒) */
    private readonly _progressUpdateInterval: number = 0.3;

    onLoad() {
        // 监听关卡开始事件
        director.getEventTarget().on(GameEvent.LEVEL_START, this._onLevelStart, this);
        director.getEventTarget().on(GameEvent.LEVEL_RETRY, this._onLevelStart, this);

        // 监听开窗事件
        director.getEventTarget().on(GameEvent.WINDOW_OPENING, this._onWindowOpening, this);

        // 监听玩家掉落事件
        director.getEventTarget().on(GameEvent.PLAYER_FALL, this._onPlayerFall, this);
    }

    onDestroy() {
        director.getEventTarget().off(GameEvent.LEVEL_START, this._onLevelStart, this);
        director.getEventTarget().off(GameEvent.LEVEL_RETRY, this._onLevelStart, this);
        director.getEventTarget().off(GameEvent.WINDOW_OPENING, this._onWindowOpening, this);
        director.getEventTarget().off(GameEvent.PLAYER_FALL, this._onPlayerFall, this);
    }

    /**
     * 关卡开始
     */
    private _onLevelStart(levelId: number): void {
        const levelMgr = LevelManager.instance;
        if (!levelMgr) {
            console.error('LevelManager not found');
            return;
        }

        levelMgr.loadLevelConfig(levelId, (config) => {
            if (!config) {
                console.error(`Level config not found: ${levelId}`);
                return;
            }
            this._levelConfig = config;
            this._initLevel();
        });
    }

    /**
     * 初始化关卡
     */
    private _initLevel(): void {
        if (!this._levelConfig) return;

        this._state = LevelState.INIT;

        // 清理旧数据
        this._clearLevel();

        const config = this._levelConfig;

        // 1. 创建楼层背景
        this._createBuildingFloor(config);

        // 2. 生成窗户
        this._createWindows(config);

        // 3. 生成NPC
        this._createNPCs(config);

        // 4. 创建玩家
        this._createPlayer(config);

        // 5. 初始化进度计算器
        this._initProgress(config);

        // 6. 初始化HUD
        this._initHUD(config);

        // 7. 开始倒计时
        this._timeLeft = config.timeLimit;
        this._progressTimer = 0;

        // 8. 初始化调试叠加层（开发阶段）
        this._initDebugOverlay();

        // 切换到 PLAYING
        this._state = LevelState.PLAYING;

        console.log(`[LevelFlow] Level ${config.levelId} initialized: ` +
            `${config.windows.length} windows, ${config.npcCount} NPCs, ` +
            `${config.timeLimit}s time limit, ${Math.round(config.targetProgress * 100)}% target`);
    }

    /** 创建楼层背景 */
    private _createBuildingFloor(config: ILevelConfig): void {
        this._buildingFloor = NodeFactory.createBuildingFloorNode(config.windows);

        if (this.gameLayer) {
            this.gameLayer.node.addChild(this._buildingFloor);
        } else {
            this.node.addChild(this._buildingFloor);
        }
    }

    /** 生成窗户 */
    private _createWindows(config: ILevelConfig): void {
        if (!this._buildingFloor) return;

        for (const winConfig of config.windows) {
            const windowNode = NodeFactory.createWindowNode(winConfig);
            this._buildingFloor.addChild(windowNode);

            // 初始化 WindowController
            const windowCtrl = windowNode.getComponent(WindowController)!;
            windowCtrl.init(winConfig);
            this._windowControllers.push(windowCtrl);
        }
    }

    /**
     * 生成NPC
     * 分配策略：均匀分布到各窗户
     * 例如：2窗户4个NPC → 每窗2个NPC
     */
    private _createNPCs(config: ILevelConfig): void {
        if (!this._buildingFloor) return;

        const windowCount = this._windowControllers.length;
        if (windowCount === 0) return;

        for (let i = 0; i < config.npcCount; i++) {
            const npcNode = NodeFactory.createNPCNode(i);

            // 均匀分配：轮流分配到各窗户
            const windowIndex = i % windowCount;
            const assignedWindow = this._windowControllers[windowIndex];

            // 添加到窗户的 NPCArea 下
            if (assignedWindow.npcArea) {
                assignedWindow.npcArea.addChild(npcNode);
            } else {
                this._buildingFloor.addChild(npcNode);
            }

            // 初始化 NPCController
            const npcCtrl = npcNode.getComponent(NPCController)!;
            npcCtrl.init(config.npcConfig, assignedWindow);
            this._npcControllers.push(npcCtrl);
        }
    }

    /** 创建玩家 */
    private _createPlayer(config: ILevelConfig): void {
        if (!this._buildingFloor) return;

        this._playerNode = NodeFactory.createPlayerNode();
        this._buildingFloor.addChild(this._playerNode);

        const playerCtrl = this._playerNode.getComponent(PlayerController)!;

        // 计算 Y 轴范围
        let yMin = Infinity;
        let yMax = -Infinity;
        for (const w of this._windowControllers) {
            const bounds = w.getWindowBounds();
            yMin = Math.min(yMin, bounds.bottom);
            yMax = Math.max(yMax, bounds.top);
        }

        // 传入 BuildingFloor 作为触摸监听目标（全区域可触摸）
        playerCtrl.init(this._windowControllers, yMin, yMax, this._buildingFloor!);

        // 初始位置：最左侧窗户中央
        if (this._windowControllers.length > 0) {
            const firstWindow = this._windowControllers[0];
            const pos = firstWindow.node.getWorldPosition();
            playerCtrl.setStartPosition(new Vec3(pos.x, pos.y, 0));
        }
    }

    /** 初始化进度计算器 */
    private _initProgress(config: ILevelConfig): void {
        if (!this.progressCalculator) return;
        this.progressCalculator.init(this._windowControllers, config.targetProgress);
    }

    /** 初始化HUD */
    private _initHUD(config: ILevelConfig): void {
        if (this.gameLayer?.hud) {
            this.gameLayer.hud.init(config.levelId, config.timeLimit, config.targetProgress);
        }
    }

    update(dt: number) {
        if (this._state !== LevelState.PLAYING) return;

        // 更新倒计时
        this._timeLeft -= dt;
        if (this._timeLeft <= 0) {
            this._timeLeft = 0;
            this._onLevelFailed(FailReason.TIME_OUT);
            return;
        }

        // 定期检查进度
        this._progressTimer += dt;
        if (this._progressTimer >= this._progressUpdateInterval) {
            this._progressTimer = 0;

            // 更新 HUD 进度
            if (this.progressCalculator) {
                const progress = this.progressCalculator.currentProgress;
                this._updateHUDProgress(progress);

                // 检查是否达标
                if (this.progressCalculator.isComplete) {
                    this._onLevelSuccess();
                    return;
                }
            }
        }

        // 更新 HUD 倒计时
        this._updateHUDCountdown();
    }

    /** 更新HUD进度显示 */
    private _updateHUDProgress(progress: number): void {
        if (this.gameLayer?.hud) {
            this.gameLayer.hud.updateProgress(progress);
        }
    }

    /** 更新HUD倒计时显示 */
    private _updateHUDCountdown(): void {
        if (this.gameLayer?.hud) {
            this.gameLayer.hud.updateCountdown(Math.ceil(this._timeLeft));
        }
    }

    /** 窗户正在打开事件 */
    private _onWindowOpening(windowId: string): void {
        if (this._state !== LevelState.PLAYING) return;

        // 播放开窗音效
        this._playSound(SoundName.WINDOW_OPEN);

        // 检查玩家是否在该窗户
        if (!this._playerNode) return;

        const playerCtrl = this._playerNode.getComponent(PlayerController);
        if (playerCtrl && playerCtrl.currentWindowId === windowId && !playerCtrl.hasFallen) {
            // 玩家掉落
            playerCtrl.fall();
        }
    }

    /** 玩家掉落事件 */
    private _onPlayerFall(): void {
        // 播放掉落音效
        this._playSound(SoundName.FALL);

        // 掉落动画完成后显示失败界面
        this.scheduleOnce(() => {
            this._onLevelFailed(FailReason.WINDOW_OPENED);
        }, 0.5);
    }

    /** 关卡成功 */
    private _onLevelSuccess(): void {
        this._state = LevelState.SUCCESS;
        if (this.progressCalculator) this.progressCalculator.stop();

        // 暂停所有NPC
        for (const npc of this._npcControllers) {
            npc.setPaused(true);
        }

        // 播放过关音乐
        this._playSound(SoundName.LEVEL_CLEAR);

        const gm = GameManager.instance;
        if (gm) gm.onLevelSuccess();

        director.getEventTarget().emit(GameEvent.LEVEL_SUCCESS);
    }

    /** 关卡失败 */
    private _onLevelFailed(reason: FailReason): void {
        this._state = LevelState.FAILED;
        if (this.progressCalculator) this.progressCalculator.stop();

        // 暂停所有NPC
        for (const npc of this._npcControllers) {
            npc.setPaused(true);
        }

        // 播放失败音效
        this._playSound(SoundName.LEVEL_FAIL);

        const gm = GameManager.instance;
        if (gm) gm.onLevelFailed();

        director.getEventTarget().emit(GameEvent.LEVEL_FAILED, reason);
    }

    /** 初始化调试叠加层 */
    private _initDebugOverlay(): void {
        // 在 Canvas 上添加调试信息层
        const canvas = this.node.getParent();
        if (canvas) {
            const debugNode = new Node('DebugOverlay');
            canvas.addChild(debugNode);
            const debugOverlay = debugNode.addComponent(DebugOverlay);
            const playerCtrl = this._playerNode?.getComponent(PlayerController) ?? null;
            debugOverlay.init(this._npcControllers, this._windowControllers, playerCtrl);
        }
    }

    /** 清理关卡数据 */
    private _clearLevel(): void {
        // 清理 BuildingFloor（包含所有窗户、NPC、玩家）
        if (this._buildingFloor && this._buildingFloor.isValid) {
            this._buildingFloor.destroy();
        }
        this._buildingFloor = null;
        this._playerNode = null;

        // 清理调试叠加层
        const canvas = this.node.getParent();
        if (canvas) {
            const debugNode = canvas.getChildByName('DebugOverlay');
            if (debugNode) debugNode.destroy();
        }

        this._windowControllers = [];
        this._npcControllers = [];
    }

    /** 播放音效辅助方法 */
    private _playSound(soundName: string): void {
        const audioMgr = AudioManager.instance;
        if (audioMgr) {
            audioMgr.play(soundName);
        }
    }
}
