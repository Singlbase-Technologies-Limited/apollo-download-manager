import type { MirrorProject } from '../../contract';

/** Each project's name, as the user knows it (#324). */
export const PROJECT_NAMES: Record<MirrorProject, string> = {
  ubuntu: 'Ubuntu',
  debian: 'Debian',
  fedora: 'Fedora',
  apache: 'Apache',
  archLinux: 'Arch Linux',
  linuxMint: 'Linux Mint',
  openSuse: 'openSUSE',
  gnu: 'GNU',
};
