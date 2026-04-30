package dev.geode.plugin

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import dev.geode.plugin.engine.EngineManager
import dev.geode.plugin.settings.GeodeSettings
import dev.geode.plugin.toolwindow.GeodeToolWindowService

class GeodeStartup : ProjectActivity {
    override suspend fun execute(project: Project) {
        val settings = GeodeSettings.getInstance()
        if (!settings.autoStartEngine) return

        val service = project.getService(GeodeToolWindowService::class.java) ?: return
        service.ensureEngineStarted()
    }
}
