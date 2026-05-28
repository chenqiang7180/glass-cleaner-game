/**
 * NodeFactory.ts - 节点工厂
 * 在运行时动态创建窗户、NPC、玩家等游戏节点
 * 这样就不需要手动在 Cocos Creator 编辑器中创建预制体
 *
 * 用法：NodeFactory.createWindowNode(config) 返回完整配置的节点
 */
import { Node, UITransform, Sprite, Color, Vec3, Widget, Label } from 'cc';
import { IWindowConfig } from '../utils/ILevelConfig';
import { WindowController } from '../gameplay/WindowController';
import { NPCController } from '../gameplay/NPCController';
import { NPCVisualHelper } from '../components/NPCVisualHelper';
import { PlayerController } from '../gameplay/PlayerController';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './Constants';

export class NodeFactory {

    /**
     * 创建一面窗户的完整节点树
     *
     * 结构：
     * Window_{id}
     * ├── CleanBG (Sprite)        # 干净的玻璃底层（蓝色半透明）
     * ├── DirtyLayer (Sprite)     # 脏层（RenderTexture，灰色覆盖）
     * ├── WindowFrame (Sprite)    # 窗框装饰
     * │   ├── HBar (Sprite)       # 水平窗棱
     * │   └── VBar (Sprite)       # 垂直窗棱
     * ├── WarningNode (Node)      # 开窗预警闪烁
     * └── NPCArea (Node)          # NPC活动区域
     */
    public static createWindowNode(config: IWindowConfig): Node {
        const windowNode = new Node(`Window_${config.id}`);

        // UITransform 设置窗户尺寸
        const uiTransform = windowNode.addComponent(UITransform);
        uiTransform.setContentSize(config.size[0], config.size[1]);
        uiTransform.setAnchorPoint(0.5, 0.5);

        // 设置位置
        windowNode.setPosition(config.position[0], config.position[1], 0);

        // --- 1. 干净底层 ---
        const cleanBG = new Node('CleanBG');
        windowNode.addChild(cleanBG);
        const cleanBGTransform = cleanBG.addComponent(UITransform);
        cleanBGTransform.setContentSize(config.size[0], config.size[1]);
        const cleanBGSprite = cleanBG.addComponent(Sprite);
        cleanBGSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 干净的玻璃：淡蓝色半透明
        cleanBGSprite.color = new Color(180, 220, 255, 200);

        // --- 2. 脏层（将由 WindowCleaner 初始化 RenderTexture 后设置 SpriteFrame） ---
        const dirtyLayer = new Node('DirtyLayer');
        windowNode.addChild(dirtyLayer);
        const dirtyTransform = dirtyLayer.addComponent(UITransform);
        dirtyTransform.setContentSize(config.size[0], config.size[1]);
        const dirtySprite = dirtyLayer.addComponent(Sprite);
        dirtySprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // --- 3. 窗框 ---
        const windowFrame = new Node('WindowFrame');
        windowNode.addChild(windowFrame);
        const frameTransform = windowFrame.addComponent(UITransform);
        frameTransform.setContentSize(config.size[0], config.size[1]);
        const frameSprite = windowFrame.addComponent(Sprite);
        frameSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 窗框：深棕色
        frameSprite.color = new Color(100, 60, 30, 255);

        // 窗户中间的十字架（两根窗棱）
        const hBar = new Node('HBar');
        windowFrame.addChild(hBar);
        const hBarTransform = hBar.addComponent(UITransform);
        hBarTransform.setContentSize(config.size[0], 8);
        const hBarSprite = hBar.addComponent(Sprite);
        hBarSprite.color = new Color(120, 80, 40, 255);

        const vBar = new Node('VBar');
        windowFrame.addChild(vBar);
        const vBarTransform = vBar.addComponent(UITransform);
        vBarTransform.setContentSize(8, config.size[1]);
        const vBarSprite = vBar.addComponent(Sprite);
        vBarSprite.color = new Color(120, 80, 40, 255);

        // --- 4. 预警节点 ---
        const warningNode = new Node('WarningNode');
        windowNode.addChild(warningNode);
        const warningTransform = warningNode.addComponent(UITransform);
        warningTransform.setContentSize(config.size[0], config.size[1]);
        const warningSprite = warningNode.addComponent(Sprite);
        warningSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 预警色：红色半透明
        warningSprite.color = new Color(255, 50, 50, 80);
        warningNode.active = false;

        // --- 5. NPC 活动区域（屋内侧，位于窗户上方） ---
        const npcArea = new Node('NPCArea');
        windowNode.addChild(npcArea);
        const npcAreaTransform = npcArea.addComponent(UITransform);
        npcAreaTransform.setContentSize(config.size[0], 200);
        // NPC区域在窗户上方（屋内侧）
        npcArea.setPosition(0, config.size[1] / 2 + 100, 0);
        const npcAreaSprite = npcArea.addComponent(Sprite);
        npcAreaSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 屋内区域：暖色半透明
        npcAreaSprite.color = new Color(200, 180, 150, 120);

        // --- 6. 挂载 WindowController ---
        const windowCtrl = windowNode.addComponent(WindowController);
        // 通过 setupVisuals 方法传递子节点引用（不使用方括号绕过类型检查）
        windowCtrl.setupVisuals(cleanBGSprite, dirtySprite, frameSprite, npcArea, warningNode);

        return windowNode;
    }

    /**
     * 创建一个NPC节点
     * 包含：身体、头部、手臂（开窗动画用）
     */
    public static createNPCNode(index: number): Node {
        const npcNode = new Node(`NPC_${index + 1}`);

        const uiTransform = npcNode.addComponent(UITransform);
        uiTransform.setContentSize(30, 50);

        // NPC 身体
        const body = new Node('Body');
        npcNode.addChild(body);
        const bodyTransform = body.addComponent(UITransform);
        bodyTransform.setContentSize(24, 40);
        const bodySprite = body.addComponent(Sprite);
        bodySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        // 随机衣服颜色
        const colors = [
            new Color(200, 80, 80, 255),   // 红
            new Color(80, 150, 200, 255),  // 蓝
            new Color(100, 180, 80, 255),  // 绿
            new Color(200, 150, 80, 255),  // 黄
            new Color(160, 80, 200, 255),  // 紫
            new Color(200, 120, 160, 255), // 粉
            new Color(100, 160, 160, 255), // 青
        ];
        bodySprite.color = colors[index % colors.length];

        // NPC 头部
        const head = new Node('Head');
        npcNode.addChild(head);
        const headTransform = head.addComponent(UITransform);
        headTransform.setContentSize(18, 18);
        head.setPosition(0, 28, 0);
        const headSprite = head.addComponent(Sprite);
        headSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        headSprite.color = new Color(240, 210, 180, 255); // 肤色

        // NPC 手臂（开窗时举起）
        const arm = new Node('Arm');
        npcNode.addChild(arm);
        const armTransform = arm.addComponent(UITransform);
        armTransform.setContentSize(6, 20);
        arm.setPosition(14, 10, 0); // 在身体右侧
        const armSprite = arm.addComponent(Sprite);
        armSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        armSprite.color = new Color(240, 210, 180, 255); // 肤色
        // 设置手臂旋转锚点为底部
        armTransform.setAnchorPoint(0.5, 0);

        // 挂载 NPCController
        npcNode.addComponent(NPCController);

        // 挂载 NPCVisualHelper（走动弹跳 + 开窗举手动画）
        npcNode.addComponent(NPCVisualHelper);

        return npcNode;
    }

    /**
     * 创建玩家节点
     * 包含：身体、头部、安全绳、擦窗工具（抹布）
     */
    public static createPlayerNode(): Node {
        const playerNode = new Node('Player');

        const uiTransform = playerNode.addComponent(UITransform);
        uiTransform.setContentSize(40, 60);

        // 玩家身体
        const body = new Node('Body');
        playerNode.addChild(body);
        const bodyTransform = body.addComponent(UITransform);
        bodyTransform.setContentSize(30, 44);
        const bodySprite = body.addComponent(Sprite);
        bodySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        bodySprite.color = new Color(50, 120, 220, 255); // 蓝色工服

        // 玩家头部
        const head = new Node('Head');
        playerNode.addChild(head);
        const headTransform = head.addComponent(UITransform);
        headTransform.setContentSize(22, 22);
        head.setPosition(0, 32, 0);
        const headSprite = head.addComponent(Sprite);
        headSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        headSprite.color = new Color(240, 210, 180, 255); // 肤色

        // 安全绳（一条竖线从头顶上方延伸）
        const rope = new Node('Rope');
        playerNode.addChild(rope);
        const ropeTransform = rope.addComponent(UITransform);
        ropeTransform.setContentSize(3, 200);
        rope.setPosition(0, 130, 0);
        const ropeSprite = rope.addComponent(Sprite);
        ropeSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        ropeSprite.color = new Color(150, 150, 150, 255); // 灰色绳

        // 擦窗工具（抹布，在身体左侧）
        const brush = new Node('Brush');
        playerNode.addChild(brush);
        const brushTransform = brush.addComponent(UITransform);
        brushTransform.setContentSize(14, 14);
        brush.setPosition(-18, -5, 0);
        const brushSprite = brush.addComponent(Sprite);
        brushSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        brushSprite.color = new Color(220, 220, 220, 255); // 白色抹布

        // 挂载 PlayerController（TouchInput 由 init 时自动创建）
        playerNode.addComponent(PlayerController);

        return playerNode;
    }

    /**
     * 创建整层楼的背景节点
     */
    public static createBuildingFloorNode(windowConfigs: IWindowConfig[]): Node {
        const floorNode = new Node('BuildingFloor');

        const uiTransform = floorNode.addComponent(UITransform);
        uiTransform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);

        // 墙壁背景
        const wallBG = new Node('WallBG');
        floorNode.addChild(wallBG);
        const wallTransform = wallBG.addComponent(UITransform);
        wallTransform.setContentSize(DESIGN_WIDTH, DESIGN_HEIGHT);
        const wallSprite = wallBG.addComponent(Sprite);
        wallSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        wallSprite.color = new Color(180, 170, 155, 255); // 暖色墙壁

        // 将墙壁放到最底层
        wallBG.setSiblingIndex(0);

        return floorNode;
    }
}
