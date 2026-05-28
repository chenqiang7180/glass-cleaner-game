/**
 * NPCVisualHelper.ts - NPC视觉增强工具
 *
 * 为NPC添加更好的视觉效果：
 * 1. 走动时身体微微上下弹跳
 * 2. 开窗时举起手的动画
 * 3. 待机时偶尔转头
 *
 * 这个组件会被 NodeFactory 自动添加到 NPC 节点上
 */
import { _decorator, Component, Node, Vec3, tween } from 'cc';
import { NPCState } from '../utils/Constants';
import { NPCController } from '../gameplay/NPCController';
const { ccclass } = _decorator;

@ccclass('NPCVisualHelper')
export class NPCVisualHelper extends Component {

    /** NPC控制器引用 */
    private _npcCtrl: NPCController | null = null;

    /** Body 节点 */
    private _bodyNode: Node | null = null;

    /** Head 节点 */
    private _headNode: Node | null = null;

    /** 手臂节点（开窗时举起） */
    private _armNode: Node | null = null;

    /** 弹跳动画的 tween */
    private _bounceTween: any = null;

    /** 上次NPC状态 */
    private _lastState: NPCState = NPCState.IDLE;

    onLoad() {
        this._npcCtrl = this.getComponent(NPCController);
        this._bodyNode = this.node.getChildByName('Body');
        this._headNode = this.node.getChildByName('Head');
        this._armNode = this.node.getChildByName('Arm');
    }

    update(dt: number) {
        if (!this._npcCtrl) return;

        const currentState = this._npcCtrl.state;

        // 状态变化时更新视觉
        if (currentState !== this._lastState) {
            this._onStateChanged(this._lastState, currentState);
            this._lastState = currentState;
        }
    }

    /** 状态变化回调 */
    private _onStateChanged(oldState: NPCState, newState: NPCState): void {
        switch (newState) {
            case NPCState.WALKING:
            case NPCState.APPROACHING_WINDOW:
                this._startBounce();
                break;
            case NPCState.IDLE:
                this._stopBounce();
                break;
            case NPCState.OPENING_WINDOW:
                this._stopBounce();
                this._playOpenAnimation();
                break;
            case NPCState.CLOSING_WINDOW:
                this._playCloseAnimation();
                break;
        }
    }

    /** 开始走动弹跳 */
    private _startBounce(): void {
        if (!this._bodyNode) return;
        this._stopBounce();

        // 身体上下弹跳
        this._bounceTween = tween(this._bodyNode)
            .repeat(999,
                tween(this._bodyNode)
                    .to(0.15, { position: new Vec3(0, 2, 0) })
                    .to(0.15, { position: new Vec3(0, -2, 0) })
            )
            .start();
    }

    /** 停止弹跳 */
    private _stopBounce(): void {
        if (this._bounceTween) {
            this._bounceTween.stop();
            this._bounceTween = null;
        }
        if (this._bodyNode) {
            this._bodyNode.setPosition(0, 0, 0);
        }
    }

    /** 开窗动画 - 举起手 */
    private _playOpenAnimation(): void {
        if (this._armNode) {
            // 手臂向上抬起
            tween(this._armNode)
                .to(0.3, { angle: -60 })
                .start();
        }
    }

    /** 关窗动画 - 手放下 */
    private _playCloseAnimation(): void {
        if (this._armNode) {
            tween(this._armNode)
                .to(0.3, { angle: 0 })
                .start();
        }
    }

    onDestroy() {
        this._stopBounce();
    }
}
