/**
 * ResultLayer.ts - 结果界面
 * 关卡成功/失败时显示
 *
 * 成功界面：显示星级评价、下一关按钮
 * 失败界面：显示失败原因、重试按钮
 */
import { _decorator, Component, Node, Label, Vec3, tween, director } from 'cc';
import { GameManager } from '../managers/GameManager';
import { FailReason, GameEvent } from '../utils/Constants';
const { ccclass, property } = _decorator;

@ccclass('ResultLayer')
export class ResultLayer extends Component {

    /** 标题 */
    @property(Label)
    public titleLabel: Label | null = null;

    /** 描述文字 */
    @property(Label)
    public descLabel: Label | null = null;

    /** 星级文字 */
    @property(Label)
    public starLabel: Label | null = null;

    /** 重试按钮 */
    @property(Node)
    public retryBtn: Node | null = null;

    /** 下一关按钮 */
    @property(Node)
    public nextBtn: Node | null = null;

    /** 返回菜单按钮 */
    @property(Node)
    public menuBtn: Node | null = null;

    /** 当前是否成功 */
    private _isSuccess: boolean = false;

    onLoad() {
        this._registerEvents();

        // 监听游戏事件自动显示
        director.getEventTarget().on(GameEvent.LEVEL_SUCCESS, this._onLevelSuccess, this);
        director.getEventTarget().on(GameEvent.LEVEL_FAILED, this._onLevelFailed, this);

        this.node.active = false;
    }

    onDestroy() {
        director.getEventTarget().off(GameEvent.LEVEL_SUCCESS, this._onLevelSuccess, this);
        director.getEventTarget().off(GameEvent.LEVEL_FAILED, this._onLevelFailed, this);
    }

    /** 收到关卡成功事件 */
    private _onLevelSuccess(): void {
        this.showSuccess();
    }

    /** 收到关卡失败事件 */
    private _onLevelFailed(reason: FailReason): void {
        this.showFailed(reason);
    }

    /** 注册按钮事件 */
    private _registerEvents(): void {
        if (this.retryBtn) {
            this.retryBtn.on(Node.EventType.TOUCH_END, this._onRetry, this);
        }
        if (this.nextBtn) {
            this.nextBtn.on(Node.EventType.TOUCH_END, this._onNext, this);
        }
        if (this.menuBtn) {
            this.menuBtn.on(Node.EventType.TOUCH_END, this._onMenu, this);
        }
    }

    /**
     * 显示成功界面
     */
    public showSuccess(): void {
        this._isSuccess = true;
        this.node.active = true;

        // 入场动画
        this.node.setScale(0.5, 0.5, 1);
        tween(this.node)
            .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        if (this.titleLabel) this.titleLabel.string = '恭喜过关!';

        if (this.descLabel) {
            const gm = GameManager.instance;
            if (gm) {
                const stars = gm.getLevelStars(gm.currentLevelId);
                this.descLabel.string = `第 ${gm.currentLevelId} 关完成`;
            } else {
                this.descLabel.string = '';
            }
        }

        // 星级显示
        if (this.starLabel) {
            const gm = GameManager.instance;
            const stars = gm ? gm.getLevelStars(gm.currentLevelId) : 1;
            this.starLabel.string = '★'.repeat(stars) + '☆'.repeat(3 - stars);
            this.starLabel.node.active = true;
        }

        // 按钮显示
        if (this.nextBtn) {
            const gm = GameManager.instance;
            // 如果是最后一关，不显示下一关按钮
            this.nextBtn.active = gm ? gm.currentLevelId < gm.maxLevelId : true;
        }
        if (this.retryBtn) this.retryBtn.active = true;
    }

    /**
     * 显示失败界面
     * @param reason 失败原因
     */
    public showFailed(reason: FailReason): void {
        this._isSuccess = false;
        this.node.active = true;

        // 入场动画
        this.node.setScale(0.5, 0.5, 1);
        tween(this.node)
            .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: 'backOut' })
            .start();

        if (this.titleLabel) this.titleLabel.string = '挑战失败';

        if (this.descLabel) {
            switch (reason) {
                case FailReason.WINDOW_OPENED:
                    this.descLabel.string = 'NPC开窗，你掉下去了!';
                    break;
                case FailReason.TIME_OUT:
                    this.descLabel.string = '时间耗尽!';
                    break;
                default:
                    this.descLabel.string = '';
            }
        }

        // 星级隐藏
        if (this.starLabel) {
            this.starLabel.node.active = false;
        }

        // 按钮
        if (this.nextBtn) this.nextBtn.active = false;
        if (this.retryBtn) this.retryBtn.active = true;
    }

    /** 隐藏结果界面 */
    public hide(): void {
        this.node.active = false;
    }

    private _onRetry(): void {
        this.hide();
        const gm = GameManager.instance;
        if (gm) gm.retryLevel();
    }

    private _onNext(): void {
        this.hide();
        const gm = GameManager.instance;
        if (gm) gm.startLevel(gm.currentLevelId + 1);
    }

    private _onMenu(): void {
        this.hide();
        const gm = GameManager.instance;
        if (gm) gm.backToMenu();
    }
}
