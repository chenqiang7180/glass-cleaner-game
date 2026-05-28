/**
 * TouchInput.ts - 触屏输入处理组件
 * 处理 touchstart/touchmove/touchend 事件，转换为移动指令
 *
 * 使用方式：挂载在游戏区域节点上（BuildingFloor 或全屏节点）
 * 通过回调将触摸事件传递给 PlayerController
 */
import { _decorator, Component, Node, EventTouch, Vec2 } from 'cc';
const { ccclass, property } = _decorator;

/** 触屏输入回调类型 */
export type TouchMoveCallback = (delta: Vec2, worldPos: Vec2) => void;

@ccclass('TouchInput')
export class TouchInput extends Component {

    /** 是否正在触摸 */
    private _touching: boolean = false;

    /** 上一次触摸位置（UI坐标） */
    private _lastTouchPos: Vec2 = new Vec2();

    /** 移动回调 */
    private _moveCallback: TouchMoveCallback | null = null;

    /** 触摸开始回调 */
    private _startCallback: ((pos: Vec2) => void) | null = null;

    /** 触摸结束回调 */
    private _endCallback: (() => void) | null = null;

    /** 最小移动阈值（像素），低于此值的移动忽略，防止抖动 */
    @property
    public deadZone: number = 2.0;

    /** 移动灵敏度系数 */
    @property
    public sensitivity: number = 1.0;

    onLoad() {
        this.node.on(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_START, this._onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this._onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this._onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    /**
     * 设置移动回调
     */
    public setMoveCallback(callback: TouchMoveCallback): void {
        this._moveCallback = callback;
    }

    /**
     * 设置触摸开始回调
     */
    public setStartCallback(callback: (pos: Vec2) => void): void {
        this._startCallback = callback;
    }

    /**
     * 设置触摸结束回调
     */
    public setEndCallback(callback: () => void): void {
        this._endCallback = callback;
    }

    /** 获取是否正在触摸 */
    public get isTouching(): boolean {
        return this._touching;
    }

    private _onTouchStart(event: EventTouch): void {
        this._touching = true;
        const pos = event.getUILocation();
        this._lastTouchPos.set(pos.x, pos.y);

        if (this._startCallback) {
            this._startCallback(this._lastTouchPos.clone());
        }

        event.propagationStopped = true;
    }

    private _onTouchMove(event: EventTouch): void {
        if (!this._touching) return;

        const pos = event.getUILocation();
        const currentPos = new Vec2(pos.x, pos.y);

        // 计算偏移量
        const delta = currentPos.clone().subtract(this._lastTouchPos);

        // 死区过滤
        if (delta.length() < this.deadZone) {
            return;
        }

        // 应用灵敏度
        delta.multiplyScalar(this.sensitivity);

        // 更新上一次位置
        this._lastTouchPos.set(currentPos.x, currentPos.y);

        // 调用回调
        if (this._moveCallback) {
            this._moveCallback(delta, currentPos);
        }

        event.propagationStopped = true;
    }

    private _onTouchEnd(event: EventTouch): void {
        this._touching = false;

        if (this._endCallback) {
            this._endCallback();
        }

        event.propagationStopped = true;
    }
}
