package dev.geodesic.plugin.toolwindow

import com.intellij.openapi.components.Service
import com.intellij.openapi.project.Project
import dev.geodesic.plugin.engine.EngineClient
import dev.geodesic.plugin.engine.EngineManager

@Service(Service.Level.PROJECT)
class GeodesicToolWindowService(private val project: Project) {
    val engineManager = EngineManager()
    var engineClient: EngineClient? = null
        private set

    private var sidebarPanel: SidebarPanel? = null

    fun registerSidebarPanel(panel: SidebarPanel) {
        sidebarPanel = panel
        engineManager.addStatusListener { status ->
            javax.swing.SwingUtilities.invokeLater { panel.onEngineStatus(status) }
        }
    }

    fun ensureEngineStarted() {
        if (engineManager.port != null) return
        Thread {
            val ok = engineManager.start()
            if (ok && engineManager.port != null) {
                engineClient = EngineClient(engineManager.port!!)
                javax.swing.SwingUtilities.invokeLater { sidebarPanel?.refreshState() }
            }
        }.also { it.isDaemon = true; it.start() }
    }

    fun dispose() {
        engineManager.stop()
    }
}
