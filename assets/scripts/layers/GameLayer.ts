/**
 * GameLayer.ts - 游戏主界面
 * 作为游戏场景的容器，管理 BuildingFloor、HUD 等子节点
 */
import { _decorator, Component } from 'cc';
import { HUDLayer } from './HUDLayer';
const { ccclass, property } = _decorator;

@ccclass('GameLayer')
export class GameLayer extends Component {

    /** HUD界面 */
    @property(HUDLayer)
    public hud: HUDLayer | null = null;

    onLoad() {
        // GameLayer 初始化
        // BuildingFloor 和 Player 由 LevelFlow 动态创建
    }
}
