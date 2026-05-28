/**
 * ProgressCalculator.ts - 清洁进度计算组件
 *
 * 实现方案：直接读取各 WindowCleaner 的 cleanedArea 计算进度
 * 优点：无需 readPixels（性能消耗大），实时性好
 * 缺点：面积估算有少量重叠误差，但对游戏体验影响极小
 */
import { _decorator, Component } from 'cc';
import { PROGRESS_SAMPLE_INTERVAL, GameEvent } from '../utils/Constants';
import { director } from 'cc';
import { WindowController } from '../gameplay/WindowController';
const { ccclass, property } = _decorator;

@ccclass('ProgressCalculator')
export class ProgressCalculator extends Component {

    /** 窗户控制器列表 */
    private _windowControllers: WindowController[] = [];

    /** 采样计时器 */
    private _sampleTimer: number = 0;

    /** 当前总进度 (0~1) */
    private _currentProgress: number = 0;

    /** 目标进度 */
    private _targetProgress: number = 0.8;

    /** 是否正在计算 */
    private _calculating: boolean = false;

    /** 上一次广播的进度值（避免重复广播） */
    private _lastBroadcastProgress: number = -1;

    /**
     * 初始化进度计算器
     * @param windowControllers 窗户控制器列表
     * @param targetProgress 目标进度
     */
    public init(windowControllers: WindowController[], targetProgress: number): void {
        this._windowControllers = windowControllers;
        this._targetProgress = targetProgress;
        this._calculating = true;
        this._currentProgress = 0;
        this._lastBroadcastProgress = -1;
    }

    /** 停止计算 */
    public stop(): void {
        this._calculating = false;
    }

    /** 获取当前进度 */
    public get progress(): number {
        return this._currentProgress;
    }

    /** 当前进度别名（供 LevelFlow 使用） */
    public get currentProgress(): number {
        return this._currentProgress;
    }

    /** 是否达标 */
    public get isComplete(): boolean {
        return this._currentProgress >= this._targetProgress;
    }

    /** 获取目标进度 */
    public get targetProgress(): number {
        return this._targetProgress;
    }

    update(dt: number) {
        if (!this._calculating || this._windowControllers.length === 0) return;

        this._sampleTimer += dt;
        if (this._sampleTimer < PROGRESS_SAMPLE_INTERVAL) return;
        this._sampleTimer = 0;

        this._calculateProgress();
    }

    /** 计算所有窗户的综合进度 */
    private _calculateProgress(): void {
        let totalProgress = 0;

        for (const w of this._windowControllers) {
            totalProgress += w.getCleanProgress();
        }

        // 平均进度
        const avgProgress = totalProgress / this._windowControllers.length;

        // 只在进度有变化时更新和广播
        if (Math.abs(avgProgress - this._lastBroadcastProgress) > 0.005) {
            this._currentProgress = avgProgress;
            this._lastBroadcastProgress = avgProgress;
            director.getEventTarget().emit(GameEvent.PROGRESS_UPDATE, this._currentProgress);
        }
    }
}
