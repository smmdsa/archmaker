import type { ITopbarManifest } from '../interfaces/ITopbarItem';
import { topbarRegistry } from '../registry/TopbarRegistry';

export function TopbarItem(manifest: ITopbarManifest) {
    return function (constructor: any) {
        topbarRegistry.register(manifest, constructor);
        console.log('TopbarItem registered', manifest);
        return constructor;
    };

} 