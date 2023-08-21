import { WebPlugin, CapacitorException } from '@capacitor/core';
import { CameraSource, CameraDirection } from './definitions';
export class CameraWeb extends WebPlugin {
    async getPhoto(options) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve, reject) => {
            if (options.webUseInput || options.source === CameraSource.Photos) {
                this.fileInputExperience(options, resolve);
            }
            else if (options.source === CameraSource.Prompt) {
                let actionSheet = document.querySelector('pwa-action-sheet');
                if (!actionSheet) {
                    actionSheet = document.createElement('pwa-action-sheet');
                    document.body.appendChild(actionSheet);
                }
                actionSheet.header = options.promptLabelHeader || 'Photo';
                actionSheet.cancelable = false;
                actionSheet.options = [
                    { title: options.promptLabelPhoto || 'From Photos' },
                    { title: options.promptLabelPicture || 'Take Picture' },
                ];
                actionSheet.addEventListener('onSelection', async (e) => {
                    const selection = e.detail;
                    if (selection === 0) {
                        this.fileInputExperience(options, resolve);
                    }
                    else {
                        await this.cameraExperience(options, resolve, reject);
                    }
                });
            }
            else {
                await this.cameraExperience(options, resolve, reject);
            }
        });
    }
    async pickImages(_) {
        // eslint-disable-next-line no-async-promise-executor
        return new Promise(async (resolve) => {
            this.multipleFileInputExperience(resolve);
        });
    }
    async cameraExperience(options, resolve, reject) {
        if (customElements.get('pwa-camera-modal')) {
            const cameraModal = document.createElement('pwa-camera-modal');
            cameraModal.facingMode =
                options.direction === CameraDirection.Front ? 'user' : 'environment';
            document.body.appendChild(cameraModal);
            try {
                await cameraModal.componentOnReady();
                cameraModal.addEventListener('onPhoto', async (e) => {
                    const photo = e.detail;
                    if (photo === null) {
                        reject(new CapacitorException('User cancelled photos app'));
                    }
                    else if (photo instanceof Error) {
                        reject(photo);
                    }
                    else {
                        resolve(await this._getCameraPhoto(photo));
                    }
                    cameraModal.dismiss();
                    document.body.removeChild(cameraModal);
                });
                cameraModal.present();
            }
            catch (e) {
                this.fileInputExperience(options, resolve);
            }
        }
        else {
            console.error(`Unable to load PWA Element 'pwa-camera-modal'. See the docs: https://capacitorjs.com/docs/web/pwa-elements.`);
            this.fileInputExperience(options, resolve);
        }
    }
    fileInputExperience(options, resolve) {
        let input = document.querySelector('#_capacitor-camera-input');
        const cleanup = () => {
            var _a;
            (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);
        };
        if (!input) {
            input = document.createElement('input');
            input.id = '_capacitor-camera-input';
            input.type = 'file';
            input.hidden = true;
            document.body.appendChild(input);
            input.addEventListener('change', (_e) => {
                var _a;
                const file = (_a = input.files) === null || _a === void 0 ? void 0 : _a[0];
                const { fileType, fileFormat } = this._getFormat(file);
                const reader = new FileReader();
                reader.addEventListener('load', () => {
                    resolve({
                        dataUrl: fileType === 'image' ? reader.result : URL.createObjectURL(file),
                        fileType,
                        fileFormat,
                        file
                    });
                    cleanup();
                });
                file && reader.readAsDataURL(file);
            });
        }
        input.accept = 'image/*,video/*';
        input.capture = true;
        if (options.source === CameraSource.Photos ||
            options.source === CameraSource.Prompt) {
            input.removeAttribute('capture');
        }
        else if (options.direction === CameraDirection.Front) {
            input.capture = 'user';
        }
        else if (options.direction === CameraDirection.Rear) {
            input.capture = 'environment';
        }
        input.click();
    }
    _getFormat(file) {
        const [fileType, fileFormat] = file.type.split('/');
        return { fileType, fileFormat };
    }
    multipleFileInputExperience(resolve) {
        let input = document.querySelector('#_capacitor-camera-input-multiple');
        const cleanup = () => {
            var _a;
            (_a = input.parentNode) === null || _a === void 0 ? void 0 : _a.removeChild(input);
        };
        if (!input) {
            input = document.createElement('input');
            input.id = '_capacitor-camera-input-multiple';
            input.type = 'file';
            input.hidden = true;
            input.multiple = true;
            document.body.appendChild(input);
            input.addEventListener('change', (_e) => {
                var _a, _b;
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                const photos = [];
                // eslint-disable-next-line @typescript-eslint/prefer-for-of,@typescript-eslint/ban-ts-comment
                // @ts-ignore
                for (let i = 0; i < ((_a = input.files) === null || _a === void 0 ? void 0 : _a.length); i++) {
                    const file = (_b = input.files) === null || _b === void 0 ? void 0 : _b[i];
                    const { fileType, fileFormat } = this._getFormat(file);
                    const reader = new FileReader();
                    reader.addEventListener('load', () => {
                        if (reader.result) {
                            const photo = {
                                dataUrl: fileType === 'image' ? reader.result : URL.createObjectURL(file),
                                fileType,
                                fileFormat,
                                file
                            };
                            photos.push(photo);
                        }
                        cleanup();
                    });
                    file && reader.readAsDataURL(file);
                }
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                resolve({ photos });
                cleanup();
            });
        }
        input.accept = 'image/*, video/*';
        input.click();
    }
    _getCameraPhoto(photo) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            const { fileType, fileFormat } = this._getFormat(photo);
            reader.readAsDataURL(photo);
            reader.onloadend = () => {
                const r = reader.result;
                resolve({
                    dataUrl: r,
                    fileFormat,
                    fileType,
                    file: photo,
                    saved: false,
                });
            };
            reader.onerror = e => {
                reject(e);
            };
        });
    }
    async checkPermissions() {
        if (typeof navigator === 'undefined' || !navigator.permissions) {
            throw this.unavailable('Permissions API not available in this browser');
        }
        try {
            const permission = await window.navigator.permissions.query({
                name: 'camera',
            });
            return {
                camera: permission.state,
                photos: 'granted',
            };
        }
        catch (_a) {
            throw this.unavailable('Camera permissions are not available in this browser');
        }
    }
    async requestPermissions() {
        throw this.unimplemented('Not implemented on web.');
    }
    async pickLimitedLibraryPhotos() {
        throw this.unavailable('Not implemented on web.');
    }
    async getLimitedLibraryPhotos() {
        throw this.unavailable('Not implemented on web.');
    }
}
const Camera = new CameraWeb();
export { Camera };
//# sourceMappingURL=web.js.map