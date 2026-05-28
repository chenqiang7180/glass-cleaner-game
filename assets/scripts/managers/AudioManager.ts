/**
 * AudioManager.ts - 音效管理器
 * 统一管理游戏中所有音效的加载与播放
 */
import { _decorator, Component, AudioSource, AudioClip, resources, Node } from 'cc';
const { ccclass, property } = _decorator;

/** 音效名称枚举 */
export enum SoundName {
    /** 擦玻璃声 */
    CLEAN = 'clean',
    /** 开窗声 */
    WINDOW_OPEN = 'window_open',
    /** 关窗声 */
    WINDOW_CLOSE = 'window_close',
    /** 掉落声 */
    FALL = 'fall',
    /** 过关音乐 */
    LEVEL_CLEAR = 'level_clear',
    /** 失败音效 */
    LEVEL_FAIL = 'level_fail',
    /** 按钮点击 */
    BUTTON_CLICK = 'button_click',
}

@ccclass('AudioManager')
export class AudioManager extends Component {

    public static instance: AudioManager | null = null;

    /** 音效缓存 */
    private _clips: Map<string, AudioClip> = new Map();

    /** 音效播放器池 */
    private _audioSources: AudioSource[] = [];

    /** 是否静音 */
    private _muted: boolean = false;

    /** 音量 */
    private _volume: number = 1.0;

    onLoad() {
        if (AudioManager.instance && AudioManager.instance !== this) {
            this.node.destroy();
            return;
        }
        AudioManager.instance = this;
    }

    onDestroy() {
        if (AudioManager.instance === this) {
            AudioManager.instance = null;
        }
    }

    /**
     * 预加载所有音效
     * 在游戏启动时调用
     */
    public preloadSounds(): void {
        const soundNames = Object.values(SoundName);
        for (const name of soundNames) {
            resources.load(`audio/${name}`, AudioClip, (err, clip) => {
                if (!err && clip) {
                    this._clips.set(name, clip);
                }
            });
        }
    }

    /**
     * 播放指定音效
     * @param name 音效名称
     * @param loop 是否循环
     */
    public play(name: string, loop: boolean = false): void {
        if (this._muted) return;

        const clip = this._clips.get(name);
        if (!clip) {
            console.warn(`Audio clip not found: ${name}`);
            return;
        }

        const source = this._getAvailableSource();
        source.clip = clip;
        source.loop = loop;
        source.volume = this._volume;
        source.play();
    }

    /** 停止指定音效 */
    public stop(name: string): void {
        for (const source of this._audioSources) {
            if (source.clip && source.clip.name === name && source.playing) {
                source.stop();
            }
        }
    }

    /** 停止所有音效 */
    public stopAll(): void {
        for (const source of this._audioSources) {
            if (source.playing) {
                source.stop();
            }
        }
    }

    /** 设置静音 */
    public setMuted(muted: boolean): void {
        this._muted = muted;
        if (muted) {
            this.stopAll();
        }
    }

    /** 设置音量 */
    public setVolume(volume: number): void {
        this._volume = Math.max(0, Math.min(1, volume));
    }

    /** 获取可用的 AudioSource */
    private _getAvailableSource(): AudioSource {
        // 查找未在播放的
        for (const source of this._audioSources) {
            if (!source.playing) {
                return source;
            }
        }
        // 没有可用的，创建新的
        const node = new Node('AudioSource');
        this.node.addChild(node);
        const newSource = node.addComponent(AudioSource);
        this._audioSources.push(newSource);
        return newSource;
    }
}
