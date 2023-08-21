import { WebPlugin, CapacitorException } from '@capacitor/core';

import { CameraSource, CameraDirection } from './definitions';
import type {
  CameraPlugin,
  GalleryImageOptions,
  GalleryPhotos,
  ImageOptions,
  PermissionStatus,
  Photo,
} from './definitions';

export class CameraWeb extends WebPlugin implements CameraPlugin {
  async getPhoto(options: ImageOptions): Promise<Photo> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<Photo>(async (resolve, reject) => {
      if (options.webUseInput || options.source === CameraSource.Photos) {
        this.fileInputExperience(options, resolve);
      } else if (options.source === CameraSource.Prompt) {
        let actionSheet: any = document.querySelector('pwa-action-sheet');
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
        actionSheet.addEventListener('onSelection', async (e: any) => {
          const selection = e.detail;
          if (selection === 0) {
            this.fileInputExperience(options, resolve);
          } else {
            await this.cameraExperience(options, resolve, reject);
          }
        });
      } else {
        await this.cameraExperience(options, resolve, reject);
      }
    });
  }

  async pickImages(_: GalleryImageOptions): Promise<GalleryPhotos> {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise<GalleryPhotos>(async resolve => {
      this.multipleFileInputExperience(resolve);
    });
  }

  private async cameraExperience(
    options: ImageOptions,
    resolve: any,
    reject: any,
  ) {
    if (customElements.get('pwa-camera-modal')) {
      const cameraModal: any = document.createElement('pwa-camera-modal');
      cameraModal.facingMode =
        options.direction === CameraDirection.Front ? 'user' : 'environment';
      document.body.appendChild(cameraModal);
      try {
        await cameraModal.componentOnReady();
        cameraModal.addEventListener('onPhoto', async (e: any) => {
          const photo = e.detail;

          if (photo === null) {
            reject(new CapacitorException('User cancelled photos app'));
          } else if (photo instanceof Error) {
            reject(photo);
          } else {
            resolve(await this._getCameraPhoto(photo));
          }

          cameraModal.dismiss();
          document.body.removeChild(cameraModal);
        });

        cameraModal.present();
      } catch (e) {
        this.fileInputExperience(options, resolve);
      }
    } else {
      console.error(
        `Unable to load PWA Element 'pwa-camera-modal'. See the docs: https://capacitorjs.com/docs/web/pwa-elements.`,
      );
      this.fileInputExperience(options, resolve);
    }
  }

  private fileInputExperience(options: ImageOptions, resolve: any) {
    let input = document.querySelector(
      '#_capacitor-camera-input',
    ) as HTMLInputElement;

    const cleanup = () => {
      input.parentNode?.removeChild(input);
    };
    if (!input) {
      input = document.createElement('input') as HTMLInputElement;
      input.id = '_capacitor-camera-input';
      input.type = 'file';
      input.hidden = true;
      document.body.appendChild(input);
      input.addEventListener('change', (_e: any) => {
        const file = input.files?.[0];
        const { fileType, fileFormat } = this._getFormat(file)
        const reader = new FileReader();
        reader.addEventListener('load', () => {
          resolve({
            dataUrl: fileType === 'image' ? reader.result : URL.createObjectURL(file),
            fileType,
            fileFormat,
            file
          } as Photo);
          cleanup();
        });
        file && reader.readAsDataURL(file);
      });
    }
    input.accept = 'image/*,video/*';
    (input as any).capture = true;
    if (
      options.source === CameraSource.Photos ||
      options.source === CameraSource.Prompt
    ) {
      input.removeAttribute('capture');
    } else if (options.direction === CameraDirection.Front) {
      (input as any).capture = 'user';
    } else if (options.direction === CameraDirection.Rear) {
      (input as any).capture = 'environment';
    }

    input.click();
  }

  private _getFormat(file: any) {
    const [ fileType, fileFormat ] = file.type.split('/');
    return { fileType, fileFormat };
  }

  private multipleFileInputExperience(resolve: any) {
    let input = document.querySelector(
      '#_capacitor-camera-input-multiple',
    ) as HTMLInputElement;

    const cleanup = () => {
      input.parentNode?.removeChild(input);
    };

    if (!input) {
      input = document.createElement('input') as HTMLInputElement;
      input.id = '_capacitor-camera-input-multiple';
      input.type = 'file';
      input.hidden = true;
      input.multiple = true;
      document.body.appendChild(input);
      input.addEventListener('change', (_e: any) => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const photos = [];
        // eslint-disable-next-line @typescript-eslint/prefer-for-of,@typescript-eslint/ban-ts-comment
        // @ts-ignore
        for (let i = 0; i < input.files?.length; i++) {
          const file = input.files?.[i];
          const { fileType, fileFormat } = this._getFormat(file)
          const reader = new FileReader();
          reader.addEventListener('load', () => {
            if (reader.result) {
              const photo = {
                dataUrl: fileType === 'image' ? reader.result : URL.createObjectURL(file),
                fileType,
                fileFormat,
                file
              } as Photo;
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

  private _getCameraPhoto(photo: Blob) {
    return new Promise<Photo>((resolve, reject) => {
      const reader = new FileReader();
      const { fileType, fileFormat } = this._getFormat(photo)
      reader.readAsDataURL(photo);
      reader.onloadend = () => {
        const r = reader.result as string;
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

  async checkPermissions(): Promise<PermissionStatus> {
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
    } catch {
      throw this.unavailable(
        'Camera permissions are not available in this browser',
      );
    }
  }

  async requestPermissions(): Promise<PermissionStatus> {
    throw this.unimplemented('Not implemented on web.');
  }

  async pickLimitedLibraryPhotos(): Promise<GalleryPhotos> {
    throw this.unavailable('Not implemented on web.');
  }

  async getLimitedLibraryPhotos(): Promise<GalleryPhotos> {
    throw this.unavailable('Not implemented on web.');
  }
}

const Camera = new CameraWeb();

export { Camera };
