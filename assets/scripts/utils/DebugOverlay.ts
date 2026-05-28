/**
 * DebugOverlay.ts - 调试信息叠加层
 * 在开发阶段显示NPC状态、窗户状态、玩家位置等
 * 正式发布时可移除此组件
 *
 * 使用：挂载到 Canvas 或任意常驻节点上，设置引用即可
 */
import { _decorator, Component, Label, Node, Color, UITransform, Widget } from 'cc';
import { NPCController } from '../gameplay/NPCController';
import { WindowController } from '../gameplay/WindowController';
import { PlayerController } from '../gameplay/PlayerController';
const { ccclass, property } = _decorator;

@ccclass('DebugOverlay')
export class DebugOverlay extends Component {

    /** NPC控制器列表 */
    private _npcControllers: NPCController[] = [];

    /** 窗户控制器列表 */
    private _windowControllers: WindowController[] = [];

    /** 玩家控制器 */
    private _playerCtrl: PlayerController | null = null;

    /** 调试信息标签 */
    private _debugLabel: Label | null = null;

    /** 更新间隔 */
    private _updateTimer: number = 0;
    private readonly _updateInterval: number = 0.2;

    /**
     * 初始化调试层
     */
    public init(npcControllers: NPCController[], windowControllers: WindowController[], playerCtrl: PlayerController | null): void {
        this._npcControllers = npcControllers;
        this._windowControllers = windowControllers;
        this._playerCtrl = playerCtrl;

        this._createDebugLabel();
    }

    /** 创建调试标签 */
    private _createDebugLabel(): void {
        const labelNode = new Node('DebugLabel');
        this.node.addChild(labelNode);

        const uiTransform = labelNode.addComponent(UITransform);
        uiTransform.setContentSize(400, 600);
        uiTransform.setAnchorPoint(0, 1);
        labelNode.setPosition(-350, 620, 0);

        // Widget 让它固定在左上角
        const widget = labelNode.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignLeft = true;
        widget.top = 10;
        widget.left = 10;

        this._debugLabel = labelNode.addComponent(Label);
        this._debugLabel.fontSize = 16;
        this._debugLabel.lineHeight = 20;
        this._debugLabel.color = new Color(255, 255, 100, 200);
        this._debugLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        this._debugLabel.horizontalAlign = Label.HorizontalAlign.LEFT;
    }

    update(dt: number) {
        this._updateTimer += dt;
        if (this._updateTimer < this._updateInterval) return;
        this._updateTimer = 0;

        if (!this._debugLabel) return;

        let text = '=== DEBUG ===\n';

        // 窗户状态
        text += '-- Windows --\n';
        for (const w of this._windowControllers) {
            const progress = Math.round(w.getCleanProgress() * 100);
            text += `  ${w.windowId}: ${w.state} prog=${progress}%${w.isLocked ? ' [LOCKED]' : ''}\n`;
        }

        // NPC状态
        text += '-- NPCs --\n';
        for (let i = 0; i < this._npcControllers.length; i++) {
            const npc = this._npcControllers[i];
            const pos = npc.node.position;
            text += `  NPC${i + 1}: ${npc.state} pos=(${Math.round(pos.x)},${Math.round(pos.y)}) opens=${npc.openCount}\n`;
        }

        // 玩家状态
        if (this._playerCtrl) {
            const pos = this._playerCtrl.node.worldPosition;
            text += '-- Player --\n';
            text += `  state=${this._playerCtrl.playerState} win=${this._playerCtrl.currentWindowId}\n`;
            text += `  pos=(${Math.round(pos.x)},${Math.round(pos.y)})\n`;
        }

        this._debugLabel.string = text;
    }
}
