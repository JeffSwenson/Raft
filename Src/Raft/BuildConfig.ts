/**
 * Defines the variables available when configuring a specific build.
 */
export interface Build {
    platform : Platform;
    architecture : Architecture;
    isDeploy : boolean;
}

export enum Platform {
    Host
}

export enum Architecture {
    Host
}