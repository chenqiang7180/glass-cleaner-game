/**
 * LevelManager.ts - 关卡配置加载管理器
 * 从 resources/levels/ 目录动态加载关卡JSON配置
 */
import { _decorator, Component, JsonAsset, resources, error } from 'cc';
import { ILevelConfig } from '../utils/ILevelConfig';
const { ccclass } = _decorator;

@ccclass('LevelManager')
export class LevelManager extends Component {

    /** 单例 */
    public static instance: LevelManager | null = null;

    /** 缓存已加载的关卡配置 */
    private _levelConfigs: Map<number, ILevelConfig> = new Map();

    onLoad() {
        if (LevelManager.instance && LevelManager.instance !== this) {
            this.node.destroy();
            return;
        }
        LevelManager.instance = this;
    }

    onDestroy() {
        if (LevelManager.instance === this) {
            LevelManager.instance = null;
        }
    }

    /**
     * 加载指定关卡的配置
     * @param levelId 关卡ID
     * @param callback 加载完成回调
     */
    public loadLevelConfig(levelId: number, callback: (config: ILevelConfig | null) => void): void {
        // 如果已缓存，直接返回
        if (this._levelConfigs.has(levelId)) {
            callback(this._levelConfigs.get(levelId)!);
            return;
        }

        // 从 resources/levels/ 目录加载
        const path = `levels/level_${levelId}`;
        resources.load(path, JsonAsset, (err, asset) => {
            if (err) {
                error(`Failed to load level config: ${path}`, err);
                callback(null);
                return;
            }

            const config = asset.json as unknown as ILevelConfig;
            this._levelConfigs.set(levelId, config);
            callback(config);
        });
    }

    /**
     * 同步获取已缓存的关卡配置
     * 需要先调用 loadLevelConfig 加载
     */
    public getLevelConfig(levelId: number): ILevelConfig | null {
        return this._levelConfigs.get(levelId) ?? null;
    }

    /** 清除缓存 */
    public clearCache(): void {
        this._levelConfigs.clear();
    }
}
