plugins {
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
    id("org.jetbrains.intellij") version "1.17.3"
}

group = "dev.geode"
version = "0.1.0"

repositories {
    mavenCentral()
}

dependencies {
    // Gson is bundled with IntelliJ Platform — available at runtime without adding it to the plugin
    compileOnly("com.google.code.gson:gson:2.10.1")
}

kotlin {
    jvmToolchain(17)
}

intellij {
    version.set("2024.1")
    type.set("IC")
    plugins.set(listOf<String>())
    downloadSources.set(false)
    updateSinceUntilBuild.set(false)
}

tasks {
    patchPluginXml {
        sinceBuild.set("241")
    }

    buildSearchableOptions {
        enabled = false
    }

    withType<org.jetbrains.kotlin.gradle.tasks.KotlinCompile> {
        kotlinOptions {
            jvmTarget = "17"
            freeCompilerArgs = listOf("-Xjvm-default=all")
        }
    }
}
