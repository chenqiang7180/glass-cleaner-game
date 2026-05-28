/**
 * SceneSetup.ts - 场景初始化引导脚本（编辑器模式）
 *
 * 注意：运行时场景初始化由 MainGame.ts 负责。
 * 此脚本仅用于在 Cocos Creator 编辑器中快速搭建场景节点结构。
 *
 * 使用方法：
 * 1. 在 Cocos Creator 中创建空场景
 * 2. 在 Canvas 节点下添加此脚本（仅在编辑器模式下运行）
 * 3. 它会自动创建所有子节点，之后可在编辑器中微调
 *
 * 正式运行时请使用 MainGame.ts 作为入口，不要同时挂载两者。
 */
import { _decorator, Component, Node, UITransform, Canvas } from 'cc';
import { GameManager } from './managers/GameManager';
import { LevelManager } from './managers/LevelManager';
import { AudioManager } from './managers/AudioManager';
import { MenuLayer } from './layers/MenuLayer';
import { GameLayer } from './layers/GameLayer';
import { HUDLayer } from './layers/HUDLayer';
import { ResultLayer } from './layers/ResultLayer';
import { LevelFlow } from './gameplay/LevelFlow';
import { PlayerController } from './gameplay/PlayerController';
import { TouchInput } from './components/TouchInput';
import { ProgressCalculator } from './components/ProgressCalculator';
const { ccclass, property } = _decorator;

@ccclass('SceneSetup')
export class SceneSetup extends Component {

    /** 是否已在编辑器模式下创建过节点 */
    private _setupDone: boolean = false;

    onLoad() {
        if (this._setupDone) return;
        this._setupDone = true;

        // 检测是否同时挂载了 MainGame，避免重复初始化
        if (this.node.getComponent('MainGame')) {
            console.warn('[SceneSetup] MainGame 已存在，跳过 SceneSetup 初始化。运行时请只使用 MainGame。');
            return;
        }

        this._setupScene();
    }

    private _setupScene(): void {
        const canvas = this.node.getComponent(Canvas);
        if (!canvas) {
            const canvasNode = this.node.getChildByName('Canvas') || this.node;
            console.log('[SceneSetup] Setting up scene...');
        }

        // 1. 创建 Manager 节点
        this._createManagerNode();

        // 2. 创建界面层节点
        this._createLayerNodes();

        console.log('[SceneSetup] Scene setup complete!');
        console.log('[SceneSetup] 请在编辑器中调整各节点位置和属性绑定');
    }

    /** 创建管理器节点 */
    private _createManagerNode(): void {
        const mgrNode = this._ensureChild('Managers');

        if (!mgrNode.getComponent(GameManager)) {
            mgrNode.addComponent(GameManager);
        }
        if (!mgrNode.getComponent(LevelManager)) {
            mgrNode.addComponent(LevelManager);
        }
        if (!mgrNode.getComponent(AudioManager)) {
            mgrNode.addComponent(AudioManager);
        }
    }

    /** 创建界面层节点 */
    private _createLayerNodes(): void {
        // MenuLayer
        const menuNode = this._ensureChild('MenuLayer');
        menuNode.addComponent(UITransform);
        if (!menuNode.getComponent(MenuLayer)) {
            menuNode.addComponent(MenuLayer);
        }

        // GameLayer
        const gameNode = this._ensureChild('GameLayer');
        gameNode.addComponent(UITransform);
        if (!gameNode.getComponent(GameLayer)) {
            gameNode.addComponent(GameLayer);
        }

        // HUDLayer
        const hudNode = this._ensureChildOf(gameNode, 'HUDLayer');
        hudNode.addComponent(UITransform);
        if (!hudNode.getComponent(HUDLayer)) {
            hudNode.addComponent(HUDLayer);
        }

        // ResultLayer
        const resultNode = this._ensureChild('ResultLayer');
        resultNode.addComponent(UITransform);
        if (!resultNode.getComponent(ResultLayer)) {
            resultNode.addComponent(ResultLayer);
        }

        // LevelFlow
        const flowNode = this._ensureChild('LevelFlow');
        if (!flowNode.getComponent(LevelFlow)) {
            flowNode.addComponent(LevelFlow);
        }
        if (!flowNode.getComponent(ProgressCalculator)) {
            flowNode.addComponent(ProgressCalculator);
        }
    }

    /** 确保子节点存在 */
    private _ensureChild(name: string): Node {
        let child = this.node.getChildByName(name);
        if (!child) {
            child = new Node(name);
            this.node.addChild(child);
        }
        return child;
    }

    /** 确保指定节点的子节点存在 */
    private _ensureChildOf(parent: Node, name: string): Node {
        let child = parent.getChildByName(name);
        if (!child) {
            child = new Node(name);
            parent.addChild(child);
        }
        return child;
    }
}
