import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

export const assetRevision = (publicDirectory) => {
    const hash = createHash('sha256');
    const visit = (directory) => {
        for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
            const filename = path.join(directory, entry.name);
            if (entry.isDirectory()) visit(filename);
            else if (/\.(glb|gltf|json|hdr|env)$/i.test(entry.name)) {
                hash.update(path.relative(publicDirectory, filename).replaceAll('\\', '/'));
                hash.update('\0');
                hash.update(readFileSync(filename));
            }
        }
    };
    visit(publicDirectory);
    return hash.digest('hex').slice(0, 16);
};
