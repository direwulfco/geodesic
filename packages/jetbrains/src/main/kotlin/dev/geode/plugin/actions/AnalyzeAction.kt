package dev.geode.plugin.actions

import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.ui.Messages
import com.intellij.openapi.wm.ToolWindowManager
import dev.geode.plugin.toolwindow.GeodeToolWindowService

class AnalyzeAction : AnAction() {
    override fun actionPerformed(e: AnActionEvent) {
        val project = e.project ?: return

        // Open the Geode tool window
        val toolWindowManager = ToolWindowManager.getInstance(project)
        val toolWindow = toolWindowManager.getToolWindow("Geode")
        if (toolWindow != null) {
            toolWindow.show()
            return
        }

        Messages.showInfoMessage(project, "Open the Geode tool window to run an analysis.", "Geode")
    }

    override fun update(e: AnActionEvent) {
        e.presentation.isEnabled = e.project != null
    }
}
