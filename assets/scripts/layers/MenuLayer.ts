/**
 * MenuLayer.ts - 主菜单界面
 * 包含：游戏标题、开始游戏按钮、关卡选择列表
 *
 * 关卡选择列表会根据 GameManager 的解锁状态动态更新
 * 显示每个关卡的星数和锁定状态
 */
import { _decorator, Component, Node, Label, Sprite, Color, UITransform } from 'cc';
import { GameManager } from '../managers/GameManager';
const { ccclass, property } = _decorator;

@ccclass('MenuLayer')
export class MenuLayer extends Component {

    /** 开始按钮（快速开始，进入当前最新关卡） */
    @property(Node)
    public startBtn: Node | null = null;

    /** 关卡选择容器 */
    @property(Node)
    public levelContainer: Node | null = null;

    /** 标题 */
    @property(Label)
    public titleLabel: Label | null = null;

    onLoad() {
        this._registerEvents();
    }

    onEnable() {
        // 每次显示时更新关卡按钮
        this._updateLevelButtons();
    }

    /** 注册按钮事件 */
    private _registerEvents(): void {
        if (this.startBtn) {
            this.startBtn.on(Node.EventType.TOUCH_END, this._onStartClick, this);
        }
    }

    /** 开始按钮点击（进入当前最新关卡） */
    private _onStartClick(): void {
        const gm = GameManager.instance;
        if (gm) {
            gm.startLevel(gm.unlockedLevel);
        }
    }

    /** 关卡按钮点击 */
    private _onLevelClick(levelId: number): void {
        const gm = GameManager.instance;
        if (gm && gm.isLevelUnlocked(levelId)) {
            gm.startLevel(levelId);
        }
    }

    /**
     * 更新关卡按钮状态
     * 动态生成关卡按钮或更新现有按钮
     */
    private _updateLevelButtons(): void {
        const gm = GameManager.instance;
        if (!gm) return;

        // 如果没有 levelContainer，自动创建关卡列表
        if (!this.levelContainer) {
            this._createLevelContainer();
            return;
        }

        // 更新已有按钮
        const buttons = this.levelContainer.children;
        for (let i = 0; i < buttons.length; i++) {
            const levelId = i + 1;
            const isUnlocked = gm.isLevelUnlocked(levelId);
            const stars = gm.getLevelStars(levelId);

            // 锁定/解锁视觉状态
            buttons[i].opacity = isUnlocked ? 255 : 120;

            // 更新星数显示
            const starLabel = buttons[i].getChildByName('StarLabel')?.getComponent(Label);
            if (starLabel) {
                starLabel.string = isUnlocked ? ('★'.repeat(stars) + '☆'.repeat(3 - stars)) : '🔒';
            }

            // 更新关卡编号
            const levelLabel = buttons[i].getChildByName('LevelLabel')?.getComponent(Label);
            if (levelLabel) {
                levelLabel.string = `第${levelId}关`;
            }

            if (isUnlocked) {
                buttons[i].off(Node.EventType.TOUCH_END);
                const lid = levelId; // 闭包捕获
                buttons[i].on(Node.EventType.TOUCH_END, () => this._onLevelClick(lid), this);
            }
        }
    }

    /** 动态创建关卡选择列表 */
    private _createLevelContainer(): void {
        const container = new Node('LevelContainer');
        this.node.addChild(container);

        const containerTransform = container.addComponent(UITransform);
        containerTransform.setContentSize(600, 400);

        container.setPosition(0, -150, 0);

        const gm = GameManager.instance;
        if (!gm) return;

        const maxLevel = gm.maxLevelId;
        const btnWidth = 120;
        const btnHeight = 80;
        const gap = 20;
        const cols = 3;

        for (let i = 0; i < maxLevel; i++) {
            const levelId = i + 1;
            const row = Math.floor(i / cols);
            const col = i % cols;

            const btn = new Node(`LevelBtn_${levelId}`);
            container.addChild(btn);

            const btnTransform = btn.addComponent(UITransform);
            btnTransform.setContentSize(btnWidth, btnHeight);

            // 计算位置
            const totalWidth = cols * btnWidth + (cols - 1) * gap;
            const x = col * (btnWidth + gap) - totalWidth / 2 + btnWidth / 2;
            const y = -row * (btnHeight + gap);
            btn.setPosition(x, y, 0);

            // 按钮背景
            const bg = new Node('BG');
            btn.addChild(bg);
            const bgTransform = bg.addComponent(UITransform);
            bgTransform.setContentSize(btnWidth, btnHeight);
            const bgSprite = bg.addComponent(Sprite);
            bgSprite.sizeMode = Sprite.SizeMode.CUSTOM;

            const isUnlocked = gm.isLevelUnlocked(levelId);
            bgSprite.color = isUnlocked
                ? new Color(80, 160, 220, 255)    // 蓝色（已解锁）
                : new Color(100, 100, 100, 255);   // 灰色（未解锁）

            // 关卡编号
            const levelLabel = new Node('LevelLabel');
            btn.addChild(levelLabel);
            const llTransform = levelLabel.addComponent(UITransform);
            llTransform.setContentSize(btnWidth, 30);
            levelLabel.setPosition(0, 10, 0);
            const ll = levelLabel.addComponent(Label);
            ll.string = `第${levelId}关`;
            ll.fontSize = 20;
            ll.color = Color.WHITE;

            // 星数
            const starNode = new Node('StarLabel');
            btn.addChild(starNode);
            const slTransform = starNode.addComponent(UITransform);
            slTransform.setContentSize(btnWidth, 20);
            starNode.setPosition(0, -15, 0);
            const sl = starNode.addComponent(Label);
            const stars = gm.getLevelStars(levelId);
            sl.string = isUnlocked ? ('★'.repeat(stars) + '☆'.repeat(3 - stars)) : '🔒';
            sl.fontSize = 16;
            sl.color = isUnlocked ? new Color(255, 220, 50, 255) : Color.GRAY;

            // 绑定点击事件
            if (isUnlocked) {
                const lid = levelId;
                btn.on(Node.EventType.TOUCH_END, () => this._onLevelClick(lid), this);
            }
        }

        this.levelContainer = container;
    }
}
