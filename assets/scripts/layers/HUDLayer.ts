/**
 * HUDLayer.ts - 游戏HUD界面
 * 显示：清洁进度条、倒计时、当前关卡信息
 *
 * LevelFlow 会主动调用 updateProgress / updateCountdown
 * 同时也监听 PROGRESS_UPDATE 事件作为备用
 */
import { _decorator, Component, Label, ProgressBar, Color, tween, Vec3 } from 'cc';
import { GameEvent, COUNTDOWN_URGENT_TIME } from '../utils/Constants';
import { director } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HUDLayer')
export class HUDLayer extends Component {

    /** 关卡标题 */
    @property(Label)
    public levelLabel: Label | null = null;

    /** 进度条 */
    @property(ProgressBar)
    public progressBar: ProgressBar | null = null;

    /** 进度文字 */
    @property(Label)
    public progressLabel: Label | null = null;

    /** 倒计时文字 */
    @property(Label)
    public timeLabel: Label | null = null;

    /** 目标进度文字 */
    @property(Label)
    public targetLabel: Label | null = null;

    /** 目标进度 */
    private _targetProgress: number = 0.8;

    /** 是否处于紧急状态 */
    private _urgent: boolean = false;

    /** 紧急状态闪烁 tween */
    private _urgentTween: any = null;

    onLoad() {
        // 监听进度更新事件（备用，LevelFlow也会直接调用updateProgress）
        director.getEventTarget().on(GameEvent.PROGRESS_UPDATE, this._onProgressUpdate, this);
    }

    onDestroy() {
        director.getEventTarget().off(GameEvent.PROGRESS_UPDATE, this._onProgressUpdate, this);
        if (this._urgentTween) { this._urgentTween.stop(); this._urgentTween = null; }
    }

    /**
     * 初始化HUD
     * @param levelId 关卡ID
     * @param timeLimit 时限(秒)
     * @param targetProgress 目标进度(0~1)
     */
    public init(levelId: number, timeLimit: number, targetProgress: number): void {
        this._targetProgress = targetProgress;
        this._urgent = false;

        if (this.levelLabel) {
            this.levelLabel.string = `第 ${levelId} 关`;
        }
        if (this.targetLabel) {
            this.targetLabel.string = `目标: ${Math.round(targetProgress * 100)}%`;
        }
        if (this.timeLabel) {
            this.timeLabel.string = `${timeLimit}s`;
            this.timeLabel.color = Color.WHITE;
            this.timeLabel.node.setScale(1, 1, 1);
        }

        this._updateProgressDisplay(0);
    }

    /**
     * 更新进度显示
     * 由 LevelFlow 定期调用
     * @param progress 当前进度 (0~1)
     */
    public updateProgress(progress: number): void {
        this._updateProgressDisplay(progress);
    }

    /**
     * 更新倒计时显示
     * 由 LevelFlow 每帧调用
     * @param seconds 剩余秒数（向上取整）
     */
    public updateCountdown(seconds: number): void {
        if (!this.timeLabel) return;

        this.timeLabel.string = `${seconds}s`;

        // 紧急状态
        if (seconds <= COUNTDOWN_URGENT_TIME && !this._urgent) {
            this._urgent = true;
            this.timeLabel.color = Color.RED;
            this._startUrgentEffect();
        } else if (seconds > COUNTDOWN_URGENT_TIME && this._urgent) {
            this._urgent = false;
            this.timeLabel.color = Color.WHITE;
            if (this._urgentTween) { this._urgentTween.stop(); this._urgentTween = null; }
            this.timeLabel.node.setScale(1, 1, 1);
        }
    }

    /** 进度更新回调（事件监听备用） */
    private _onProgressUpdate(progress: number): void {
        this._updateProgressDisplay(progress);
    }

    /** 更新进度显示 */
    private _updateProgressDisplay(progress: number): void {
        const pct = Math.round(progress * 100);
        if (this.progressBar) {
            this.progressBar.progress = progress;
        }
        if (this.progressLabel) {
            this.progressLabel.string = `${pct}%`;
        }
    }

    /** 紧急状态闪烁效果 */
    private _startUrgentEffect(): void {
        if (!this.timeLabel) return;

        // 停止旧的闪烁
        if (this._urgentTween) { this._urgentTween.stop(); }

        // 闪烁动画
        this._urgentTween = tween(this.timeLabel.node)
            .repeat(20,
                tween(this.timeLabel.node)
                    .to(0.3, { scale: new Vec3(1.2, 1.2, 1) })
                    .to(0.3, { scale: new Vec3(1, 1, 1) })
            )
            .start();
    }

    /** 停止HUD（关卡结束时调用） */
    public stop(): void {
        this._urgent = false;
        if (this._urgentTween) { this._urgentTween.stop(); this._urgentTween = null; }
    }
}
