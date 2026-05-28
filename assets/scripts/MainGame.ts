/**
 * MainGame.ts - 游戏主入口
 * 挂载在场景根节点（Canvas）上
 * 负责初始化所有管理器、创建UI层、启动游戏
 */
import { _decorator, Component, Node, UITransform, Widget, Sprite, Label, ProgressBar, Color, Canvas } from 'cc';
import { GameManager } from './managers/GameManager';
import { LevelManager } from './managers/LevelManager';
import { AudioManager } from './managers/AudioManager';
import { MenuLayer } from './layers/MenuLayer';
import { GameLayer } from './layers/GameLayer';
import { HUDLayer } from './layers/HUDLayer';
import { ResultLayer } from './layers/ResultLayer';
import { LevelFlow } from './gameplay/LevelFlow';
import { ProgressCalculator } from './components/ProgressCalculator';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './utils/Constants';
const { ccclass, property } = _decorator;

@ccclass('MainGame')
export class MainGame extends Component {

    /** Canvas 引用 */
    private _canvas: Canvas | null = null;

    /** 各界面层节点 */
    private _menuLayer: Node | null = null;
    private _gameLayer: Node | null = null;
    private _resultLayer: Node | null = null;

    onLoad() {
        console.log('[MainGame] Initializing...');

        this._canvas = this.node.getComponent(Canvas);
        if (!this._canvas) {
            console.error('[MainGame] Canvas component not found on root node!');
            return;
        }

        // 1. 创建管理器节点
        this._createManagers();

        // 2. 创建UI层
        this._createUI();

        // 3. 初始化管理器
        this._initManagers();

        console.log('[MainGame] Initialization complete!');
    }

    /** 创建管理器节点 */
    private _createManagers(): void {
        const mgrNode = new Node('Managers');
        this.node.addChild(mgrNode);

        mgrNode.addComponent(GameManager);
        mgrNode.addComponent(LevelManager);
        mgrNode.addComponent(AudioManager);
    }

    /** 创建UI层 */
    private _createUI(): void {
        // --- MenuLayer ---
        this._menuLayer = this._createLayerNode('MenuLayer');
        this._setupMenuLayer(this._menuLayer);

        // --- GameLayer ---
        this._gameLayer = this._createLayerNode('GameLayer');
        const gameLayerComp = this._gameLayer.addComponent(GameLayer);

        // HUD 子节点
        const hudNode = new Node('HUD');
        this._gameLayer.addChild(hudNode);
        const hudComp = hudNode.addComponent(HUDLayer);
        this._setupHUD(hudNode, hudComp);

        gameLayerComp.hud = hudComp;

        // LevelFlow（挂在 GameLayer 下）
        const levelFlowComp = this._gameLayer.addComponent(LevelFlow);
        const progressCalc = this._gameLayer.addComponent(ProgressCalculator);
        levelFlowComp.progressCalculator = progressCalc;
        levelFlowComp.gameLayer = gameLayerComp;

        // --- ResultLayer ---
        this._resultLayer = this._createLayerNode('ResultLayer');
        const resultComp = this._resultLayer.addComponent(ResultLayer);
        this._setupResultLayer(this._resultLayer, resultComp);

        // 绑定 GameManager 的层引用
        this.scheduleOnce(() => {
            const gm = GameManager.instance;
            if (gm) {
                gm.menuLayer = this._menuLayer;
                gm.gameLayer = this._gameLayer;
                gm.resultLayer = this._resultLayer;
            }
        }, 0);
    }

    /** 创建一个全屏层节点 */
    private _createLayerNode(name: string): Node {
        const node = new Node(name);
        this.node.addChild(node);

        const uiTransform = node.addComponent(UITransform);
        uiTransform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);

        // Widget 铺满父节点
        const widget = node.addComponent(Widget);
        widget.isAlignTop = true;
        widget.isAlignBottom = true;
        widget.isAlignLeft = true;
        widget.isAlignRight = true;
        widget.top = 0;
        widget.bottom = 0;
        widget.left = 0;
        widget.right = 0;

        return node;
    }

    /** 设置菜单层 */
    private _setupMenuLayer(menuNode: Node): void {
        const menuComp = menuNode.addComponent(MenuLayer);

        // 标题
        const title = new Node('Title');
        menuNode.addChild(title);
        const titleTransform = title.addComponent(UITransform);
        titleTransform.setContentSize(400, 60);
        title.setPosition(0, 200, 0);
        const titleLabel = title.addComponent(Label);
        titleLabel.string = '擦玻璃大师';
        titleLabel.fontSize = 48;
        titleLabel.color = new Color(255, 255, 255, 255);

        // 开始按钮
        const startBtn = new Node('StartBtn');
        menuNode.addChild(startBtn);
        const startBtnTransform = startBtn.addComponent(UITransform);
        startBtnTransform.setContentSize(200, 60);
        startBtn.setPosition(0, 0, 0);
        const startBtnSprite = startBtn.addComponent(Sprite);
        startBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        startBtnSprite.color = new Color(50, 150, 50, 255);

        const startLabel = new Node('Label');
        startBtn.addChild(startLabel);
        const startLabelTransform = startLabel.addComponent(UITransform);
        startLabelTransform.setContentSize(200, 60);
        const startLabelComp = startLabel.addComponent(Label);
        startLabelComp.string = '开始游戏';
        startLabelComp.fontSize = 28;
        startLabelComp.color = new Color(255, 255, 255, 255);

        menuComp.startBtn = startBtn;
    }

    /** 设置HUD */
    private _setupHUD(hudNode: Node, hudComp: HUDLayer): void {
        // 关卡标题
        const levelLabelNode = new Node('LevelLabel');
        hudNode.addChild(levelLabelNode);
        levelLabelNode.setPosition(0, 580, 0);
        const levelLabel = levelLabelNode.addComponent(Label);
        levelLabel.fontSize = 32;
        levelLabel.color = new Color(255, 255, 255, 255);

        // 进度条
        const progressBarNode = new Node('ProgressBar');
        hudNode.addChild(progressBarNode);
        progressBarNode.setPosition(0, 540, 0);
        const progressBarTransform = progressBarNode.addComponent(UITransform);
        progressBarTransform.setContentSize(400, 30);
        const progressBar = progressBarNode.addComponent(ProgressBar);
        progressBar.sizeMode = ProgressBar.SizeMode.CUSTOM;

        // 进度文字
        const progressLabelNode = new Node('ProgressLabel');
        hudNode.addChild(progressLabelNode);
        progressLabelNode.setPosition(0, 500, 0);
        const progressLabel = progressLabelNode.addComponent(Label);
        progressLabel.fontSize = 24;
        progressLabel.color = new Color(255, 255, 255, 255);

        // 时间标签
        const timeLabelNode = new Node('TimeLabel');
        hudNode.addChild(timeLabelNode);
        timeLabelNode.setPosition(280, 580, 0);
        const timeLabel = timeLabelNode.addComponent(Label);
        timeLabel.fontSize = 28;
        timeLabel.color = new Color(255, 255, 255, 255);

        // 目标进度
        const targetLabelNode = new Node('TargetLabel');
        hudNode.addChild(targetLabelNode);
        targetLabelNode.setPosition(0, 460, 0);
        const targetLabel = targetLabelNode.addComponent(Label);
        targetLabel.fontSize = 20;
        targetLabel.color = new Color(200, 200, 200, 255);

        hudComp.levelLabel = levelLabel;
        hudComp.progressBar = progressBar;
        hudComp.progressLabel = progressLabel;
        hudComp.timeLabel = timeLabel;
        hudComp.targetLabel = targetLabel;
    }

    /** 设置结果层 */
    private _setupResultLayer(resultNode: Node, resultComp: ResultLayer): void {
        // 标题
        const titleNode = new Node('Title');
        resultNode.addChild(titleNode);
        titleNode.setPosition(0, 100, 0);
        const titleLabel = titleNode.addComponent(Label);
        titleLabel.fontSize = 48;
        titleLabel.color = new Color(255, 255, 255, 255);

        // 描述
        const descNode = new Node('Desc');
        resultNode.addChild(descNode);
        descNode.setPosition(0, 30, 0);
        const descLabel = descNode.addComponent(Label);
        descLabel.fontSize = 24;
        descLabel.color = new Color(200, 200, 200, 255);

        // 重试按钮
        const retryBtn = new Node('RetryBtn');
        resultNode.addChild(retryBtn);
        retryBtn.setPosition(0, -60, 0);
        const retryBtnTransform = retryBtn.addComponent(UITransform);
        retryBtnTransform.setContentSize(180, 50);
        const retryBtnSprite = retryBtn.addComponent(Sprite);
        retryBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        retryBtnSprite.color = new Color(200, 100, 50, 255);

        const retryLabel = new Node('Label');
        retryBtn.addChild(retryLabel);
        const retryLabelTransform = retryLabel.addComponent(UITransform);
        retryLabelTransform.setContentSize(180, 50);
        const retryLabelComp = retryLabel.addComponent(Label);
        retryLabelComp.string = '重试';
        retryLabelComp.fontSize = 24;
        retryLabelComp.color = new Color(255, 255, 255, 255);

        // 下一关按钮
        const nextBtn = new Node('NextBtn');
        resultNode.addChild(nextBtn);
        nextBtn.setPosition(0, -130, 0);
        const nextBtnTransform = nextBtn.addComponent(UITransform);
        nextBtnTransform.setContentSize(180, 50);
        const nextBtnSprite = nextBtn.addComponent(Sprite);
        nextBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        nextBtnSprite.color = new Color(50, 150, 50, 255);

        const nextLabel = new Node('Label');
        nextBtn.addChild(nextLabel);
        const nextLabelTransform = nextLabel.addComponent(UITransform);
        nextLabelTransform.setContentSize(180, 50);
        const nextLabelComp = nextLabel.addComponent(Label);
        nextLabelComp.string = '下一关';
        nextLabelComp.fontSize = 24;
        nextLabelComp.color = new Color(255, 255, 255, 255);

        // 返回菜单按钮
        const menuBtn = new Node('MenuBtn');
        resultNode.addChild(menuBtn);
        menuBtn.setPosition(0, -200, 0);
        const menuBtnTransform = menuBtn.addComponent(UITransform);
        menuBtnTransform.setContentSize(180, 50);
        const menuBtnSprite = menuBtn.addComponent(Sprite);
        menuBtnSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        menuBtnSprite.color = new Color(100, 100, 150, 255);

        const menuLabel = new Node('Label');
        menuBtn.addChild(menuLabel);
        const menuLabelTransform = menuLabel.addComponent(UITransform);
        menuLabelTransform.setContentSize(180, 50);
        const menuLabelComp = menuLabel.addComponent(Label);
        menuLabelComp.string = '返回菜单';
        menuLabelComp.fontSize = 24;
        menuLabelComp.color = new Color(255, 255, 255, 255);

        // 星级显示
        const starNode = new Node('StarLabel');
        resultNode.addChild(starNode);
        starNode.setPosition(0, 160, 0);
        const starLabel = starNode.addComponent(Label);
        starLabel.fontSize = 40;
        starLabel.color = new Color(255, 220, 50, 255);
        starLabel.string = '';

        // 绑定到 ResultLayer 组件
        resultComp.titleLabel = titleLabel;
        resultComp.descLabel = descLabel;
        resultComp.starLabel = starLabel;
        resultComp.retryBtn = retryBtn;
        resultComp.nextBtn = nextBtn;
        resultComp.menuBtn = menuBtn;

        // 默认隐藏
        resultNode.active = false;
    }

    /** 初始化管理器 */
    private _initManagers(): void {
        // 预加载音效
        const audioMgr = AudioManager.instance;
        if (audioMgr) {
            audioMgr.preloadSounds();
        }
    }
}
