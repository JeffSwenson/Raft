import * as _ from 'underscore';

import * as CMake from './cmake';
import {raftlog} from './log';
import {DependencyDescriptor} from './raft-file-descriptor';
import {Build} from './build-config';
import {Path} from './path';
import {Project} from './project';
import {Repository} from './VCS';

/**
 * Interface used to interact with a build dependency.
 */
export interface Dependency {
    /**
     * The name of the dependency.  Must be unique in a build.
     */
    name : string;

    /**
     * Patches that are applied to the dependency.
     */
    patches : Path [];

    /**
     * Download the source and binaries used by the dependency.
     * @param  project Root raft project that is being built.
     * @param  build   Configuration for the current build.
     * @return A promise that resolves once the download is finished.
     */
    download(project : Project, build : Build) : Promise<any>;

    /**
     * Build the dependency and install it so that it is accessible to other dependencies
     * and the root project.
     * @param project Root raft project that is being built.
     * @param build   Configuration for the current build.
     * @return A promise that resolves once the project is built and installed.
     */
    buildInstall(project : Project, build : Build) : Promise<any>;
}

/**
 * A dependency that downloads its source from a repository.
 */
export class RepositoryDependency implements Dependency {
    /**
     * @param  name The name of the dependency.
     * @param  repo The repository the source can be downloaded from.
     * @param  patches Array of patches that will be applied to the dependency.
     */
    constructor(public descriptor : DependencyDescriptor, public repository : Repository, public patches : Path []) {
    }

    /**
     * @see Dependency.Dependency.download
     */
    async download(project : Project, build : Build) {
        let dependencyDir = project.dirForDependency(this.name);
        if (dependencyDir.exists()) {
            return;
        }

        await this.repository.download(dependencyDir);
        for (let patch of this.patches) {
            await this.repository.patch(dependencyDir, patch);
        }
    }

    /**
     * @see Dependency.Dependency.buildInstall
     */
    buildInstall(project : Project, build : Build) : Promise<any> { return null };

    get name () {
        return this.descriptor.name;
    }
}

/**
 * A dependency that can be used to build a standard CMake project.
 */
export class CMakeDependency extends RepositoryDependency {
    /**
     * @see Dependency.Dependency.buildInstall
     */
    buildInstall(project : Project, build : Build) : Promise<any> {
        let sourceLocation = project.dirForDependency(this.name);
        let buildLocation = project.dirForDependencyBuild(this.name, build);
        let installLocation = project.dirForDependencyInstall(build);
        let cmakeOptions = CMake.CMakeOptions
            .create(installLocation)
            .isReleaseBuild(build.releaseBuild)
            .platform(build.platform)
            .configOptions(this.descriptor.configOptions);

        return CMake.configure(sourceLocation, buildLocation, cmakeOptions)
        .then(() => {
            return CMake.build(buildLocation);
        }).then(() => {
            return CMake.install(buildLocation);
        });
    }
}

/**
 * Download, build, and install the dependency for the project and build configuration.
 * @param  project    The root raft project.
 * @param  build      The configuration of the current build.
 * @param  dependency The dependency that is being built.
 * @return A promise that resolves once the dependency is ready for use.
 */
export function getDependency(project : Project, build : Build, dependency : Dependency) {
    raftlog(dependency.name, "Downloading");
    return dependency.download(project, build)
    .then(() => {
        raftlog(dependency.name, "Building");
        return dependency.buildInstall(project, build);
    }).then(() => {
        raftlog(dependency.name, "Ready");
    });
}
