/**
 * WindowCleaner.ts - 擦窗核心逻辑组件
 *
 * 实现方案：RenderTexture + 纯 Cocos API
 *
 * 原理：
 * 1. 每面窗户创建一张 RenderTexture (512x512) 作为脏层
 * 2. 初始化时用灰色像素填充整个 RT（表示脏）
 * 3. 擦窗时：读取 RT 像素 → 在 canvas 上用 destination-out 擦除 → 写回 RT
 * 4. 将 RT 设为 Sprite 的 spriteFrame 叠加在干净底层上
 * 5. 进度通过统计 RT 中已擦除（alpha < 128）的像素占比计算
 *
 * 注意：
 * - 微信小环境中 document.createElement('canvas') 不可用
 * - 改用 Uint8Array 直接操作像素数据，通过 RenderTexture.uploadData() 写回
 */
import { _decorator, Component, RenderTexture, Sprite, SpriteFrame } from 'cc';
import { RT_SIZE, BRUSH_RADIUS, PROGRESS_SAMPLE_STEP } from '../utils/Constants';
const { ccclass, property } = _decorator;

@ccclass('WindowCleaner')
export class WindowCleaner extends Component {

    /** 脏层 RenderTexture */
    private _dirtyRT: RenderTexture | null = null;

    /** 像素数据缓冲区（RGBA） */
    private _pixels: Uint8Array | null = null;

    /** 窗户尺寸（设计尺寸） */
    private _windowWidth: number = 300;
    private _windowHeight: number = 400;

    /** 是否已初始化 */
    private _initialized: boolean = false;

    /** 脏层 Sprite 引用 */
    private _dirtySprite: Sprite | null = null;

    /** 上一次擦除点（用于插值连续擦除） */
    private _lastCleanX: number = NaN;
    private _lastCleanY: number = NaN;

    /** 是否需要更新 Sprite（脏标记） */
    private _needsUpdate: boolean = false;

    /** RT 尺寸 */
    private readonly _rtSize: number = RT_SIZE;

    /**
     * 初始化擦窗系统
     * @param windowWidth 窗户宽度
     * @param windowHeight 窗户高度
     * @param dirtySprite 脏层 Sprite 组件引用
     */
    public init(windowWidth: number, windowHeight: number, dirtySprite: Sprite | null): void {
        this._windowWidth = windowWidth;
        this._windowHeight = windowHeight;
        this._dirtySprite = dirtySprite;

        this._createRenderTexture();
        this._fillDirty();
        this._syncToSprite();

        this._initialized = true;
    }

    /** 获取脏层 RenderTexture */
    public get dirtyRenderTexture(): RenderTexture | null {
        return this._dirtyRT;
    }

    /**
     * 获取当前清洁进度 (0~1)
     * 通过采样 RT 像素计算
     */
    public get cleanProgress(): number {
        if (!this._pixels) return 0;

        let cleanCount = 0;
        let totalSampled = 0;

        for (let y = 0; y < this._rtSize; y += PROGRESS_SAMPLE_STEP) {
            for (let x = 0; x < this._rtSize; x += PROGRESS_SAMPLE_STEP) {
                const idx = (y * this._rtSize + x) * 4;
                const alpha = this._pixels![idx + 3];
                if (alpha < 128) {
                    cleanCount++;
                }
                totalSampled++;
            }
        }

        return totalSampled > 0 ? cleanCount / totalSampled : 0;
    }

    /**
     * 在指定位置擦除
     * @param localX 窗户局部坐标 X（中心为0）
     * @param localY 窗户局部坐标 Y（中心为0）
     * @param radius 擦除半径
     */
    public cleanAt(localX: number, localY: number, radius: number = BRUSH_RADIUS): void {
        if (!this._initialized || !this._pixels) return;

        // 将窗户局部坐标转换为 RT 像素坐标
        // 窗户局部：中心(0,0)
        // RT像素：左上角(0,0)，右下角(RT_SIZE, RT_SIZE)
        const scaleX = this._rtSize / this._windowWidth;
        const scaleY = this._rtSize / this._windowHeight;
        const cx = Math.round((localX + this._windowWidth / 2) * scaleX);
        const cy = Math.round((this._windowHeight / 2 - localY) * scaleY); // Y轴翻转
        const rtRadius = Math.round(radius * Math.min(scaleX, scaleY));

        // 如果有上一个擦除点，进行插值以避免快速滑动时的间隔
        if (!isNaN(this._lastCleanX) && !isNaN(this._lastCleanY)) {
            const dx = cx - this._lastCleanX;
            const dy = cy - this._lastCleanY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const step = Math.max(rtRadius * 0.3, 1);

            if (dist > step) {
                const steps = Math.ceil(dist / step);
                for (let i = 1; i <= steps; i++) {
                    const t = i / steps;
                    const ix = Math.round(this._lastCleanX + dx * t);
                    const iy = Math.round(this._lastCleanY + dy * t);
                    this._eraseCircle(ix, iy, rtRadius);
                }
            } else {
                this._eraseCircle(cx, cy, rtRadius);
            }
        } else {
            this._eraseCircle(cx, cy, rtRadius);
        }

        this._lastCleanX = cx;
        this._lastCleanY = cy;
        this._needsUpdate = true;
    }

    /** 触摸结束时重置上一个擦除点 */
    public onCleanEnd(): void {
        this._lastCleanX = NaN;
        this._lastCleanY = NaN;
    }

    /**
     * 重置脏层（全部变脏）
     */
    public resetDirty(): void {
        this._lastCleanX = NaN;
        this._lastCleanY = NaN;
        this._fillDirty();
        this._syncToSprite();
    }

    /** 创建 RenderTexture */
    private _createRenderTexture(): void {
        this._dirtyRT = new RenderTexture();
        this._dirtyRT.reset({
            width: this._rtSize,
            height: this._rtSize,
        });
    }

    /** 初始填充脏层 — 灰色覆盖 + 随机污渍 */
    private _fillDirty(): void {
        const size = this._rtSize;
        this._pixels = new Uint8Array(size * size * 4);

        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;

                // 基础灰色覆盖 (R, G, B, A)
                this._pixels[idx] = 120;     // R
                this._pixels[idx + 1] = 120; // G
                this._pixels[idx + 2] = 130; // B
                this._pixels[idx + 3] = 210; // A (半透明)

                // 添加随机污渍变化
                const noise = Math.random() * 20 - 10;
                this._pixels[idx] = Math.max(0, Math.min(255, this._pixels[idx] + noise));
                this._pixels[idx + 1] = Math.max(0, Math.min(255, this._pixels[idx + 1] + noise));
                this._pixels[idx + 2] = Math.max(0, Math.min(255, this._pixels[idx + 2] + noise));
            }
        }

        // 添加一些更大的圆形污渍
        this._addStain(size * 0.3, size * 0.4, 40);
        this._addStain(size * 0.7, size * 0.6, 30);
        this._addStain(size * 0.5, size * 0.2, 50);

        // 写入 RT
        this._dirtyRT!.uploadData(this._pixels);
    }

    /** 添加一个圆形污渍 */
    private _addStain(cx: number, cy: number, radius: number): void {
        const size = this._rtSize;
        if (!this._pixels) return;

        const r2 = radius * radius;
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(size, Math.ceil(cy + radius)); y++) {
            for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(size, Math.ceil(cx + radius)); x++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    const idx = (y * size + x) * 4;
                    // 污渍颜色更深
                    this._pixels[idx] = Math.max(0, this._pixels[idx] - 20);
                    this._pixels[idx + 1] = Math.max(0, this._pixels[idx + 1] - 20);
                    this._pixels[idx + 2] = Math.max(0, this._pixels[idx + 2] - 15);
                    this._pixels[idx + 3] = Math.min(255, this._pixels[idx + 3] + 30);
                }
            }
        }
    }

    /** 在像素数据上擦除一个圆 */
    private _eraseCircle(cx: number, cy: number, radius: number): void {
        const size = this._rtSize;
        if (!this._pixels) return;

        const r2 = radius * radius;
        for (let y = Math.max(0, Math.floor(cy - radius)); y < Math.min(size, Math.ceil(cy + radius)); y++) {
            for (let x = Math.max(0, Math.floor(cx - radius)); x < Math.min(size, Math.ceil(cx + radius)); x++) {
                const dx = x - cx;
                const dy = y - cy;
                if (dx * dx + dy * dy <= r2) {
                    const idx = (y * size + x) * 4;
                    // 擦除：将 alpha 设为 0（透明），同时淡化 RGB
                    this._pixels[idx] = Math.max(0, this._pixels[idx] - 60);
                    this._pixels[idx + 1] = Math.max(0, this._pixels[idx + 1] - 60);
                    this._pixels[idx + 2] = Math.max(0, this._pixels[idx + 2] - 60);
                    this._pixels[idx + 3] = 0; // 透明 = 擦干净
                }
            }
        }
    }

    /** 将像素数据同步到 RenderTexture 并更新 Sprite */
    private _syncToSprite(): void {
        if (!this._dirtyRT || !this._pixels) return;

        this._dirtyRT.uploadData(this._pixels);

        // 更新 Sprite 的 spriteFrame
        if (this._dirtySprite) {
            const spriteFrame = new SpriteFrame();
            spriteFrame.texture = this._dirtyRT;
            this._dirtySprite.spriteFrame = spriteFrame;
        }
    }

    update(dt: number) {
        // 每帧检查是否需要更新 Sprite（减少不必要的更新频率）
        if (this._needsUpdate) {
            this._syncToSprite();
            this._needsUpdate = false;
        }
    }

    onDestroy() {
        if (this._dirtyRT) {
            this._dirtyRT.destroy();
            this._dirtyRT = null;
        }
        this._pixels = null;
    }
}
