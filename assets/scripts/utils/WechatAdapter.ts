/**
 * WechatAdapter.ts - 微信小游戏适配工具
 *
 * 处理微信小游戏与浏览器环境的差异：
 * 1. 存储：wx.setStorageSync / wx.getStorageSync vs localStorage
 * 2. 性能：wx.getPerformance() 监控
 * 3. 分享：wx.onShareAppMessage / wx.shareAppMessage
 * 4. 系统信息：wx.getSystemInfoSync()
 * 5. 震动反馈：wx.vibrateShort()
 * 6. 广告：激励视频广告（可选）
 */
import { _decorator, Component } from 'cc';
const { ccclass } = _decorator;

/** 微信小游戏API类型声明（避免TS报错） */
declare const wx: any;

/** 浏览器 window 对象声明 */
declare const window: any | undefined;

@ccclass('WechatAdapter')
export class WechatAdapter extends Component {

    private static _instance: WechatAdapter | null = null;

    /** 是否微信小游戏环境 */
    private _isWechat: boolean = false;

    /** 系统信息 */
    private _systemInfo: any = null;

    public static get instance(): WechatAdapter | null {
        return WechatAdapter._instance;
    }

    public get isWechat(): boolean {
        return this._isWechat;
    }

    onLoad() {
        if (WechatAdapter._instance && WechatAdapter._instance !== this) {
            this.node.destroy();
            return;
        }
        WechatAdapter._instance = this;

        // 检测微信小游戏环境
        this._isWechat = typeof wx !== 'undefined' && typeof wx.getSystemInfoSync === 'function';

        if (this._isWechat) {
            this._initWechat();
        }
    }

    onDestroy() {
        if (WechatAdapter._instance === this) {
            WechatAdapter._instance = null;
        }
    }

    /** 初始化微信小游戏API */
    private _initWechat(): void {
        // 获取系统信息
        this._systemInfo = wx.getSystemInfoSync();
        console.log(`[WechatAdapter] System: ${this._systemInfo.model}, ` +
            `Screen: ${this._systemInfo.screenWidth}x${this._systemInfo.screenHeight}, ` +
            `DPR: ${this._systemInfo.pixelRatio}`);

        // 设置分享
        this._setupShare();

        // 设置屏幕常亮
        wx.setKeepScreenOn && wx.setKeepScreenOn({ keepScreenOn: true });
    }

    /** 设置微信分享 */
    private _setupShare(): void {
        if (!this._isWechat) return;

        // 显示分享按钮
        wx.showShareMenu && wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage', 'shareTimeline']
        });

        // 设置默认分享内容
        wx.onShareAppMessage && wx.onShareAppMessage(() => {
            return {
                title: '擦玻璃大师 - 快来挑战!',
                imageUrl: '', // 需要配置分享图
            };
        });
    }

    /**
     * 主动分享
     * @param title 分享标题
     * @param imageUrl 分享图片URL
     */
    public share(title?: string, imageUrl?: string): void {
        if (!this._isWechat) return;

        wx.shareAppMessage && wx.shareAppMessage({
            title: title || '擦玻璃大师 - 快来挑战!',
            imageUrl: imageUrl || '',
        });
    }

    /**
     * 短震动反馈
     * 用于开窗预警、掉落等关键时刻
     */
    public vibrateShort(): void {
        if (!this._isWechat) return;

        wx.vibrateShort && wx.vibrateShort({
            type: 'light'
        });
    }

    /**
     * 长震动反馈
     * 用于掉落失败
     */
    public vibrateLong(): void {
        if (!this._isWechat) return;

        wx.vibrateLong && wx.vibrateLong();
    }

    /**
     * 获取系统信息
     */
    public getSystemInfo(): any {
        return this._systemInfo;
    }

    /**
     * 显示Toast提示
     */
    public showToast(title: string, duration: number = 1500): void {
        if (!this._isWechat) {
            console.log(`[Toast] ${title}`);
            return;
        }

        wx.showToast && wx.showToast({
            title: title,
            icon: 'none',
            duration: duration
        });
    }

    /**
     * 显示模态对话框
     */
    public showModal(title: string, content: string, confirmCallback?: () => void): void {
        if (!this._isWechat) {
            const result = window.confirm(`${title}\n${content}`);
            if (result && confirmCallback) confirmCallback();
            return;
        }

        wx.showModal && wx.showModal({
            title: title,
            content: content,
            success: (res: any) => {
                if (res.confirm && confirmCallback) {
                    confirmCallback();
                }
            }
        });
    }
}
