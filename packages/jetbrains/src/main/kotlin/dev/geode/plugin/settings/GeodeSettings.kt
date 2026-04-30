package dev.geode.plugin.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.util.xmlb.XmlSerializerUtil

@State(name = "GeodeSettings", storages = [Storage("geode.xml")])
class GeodeSettings : PersistentStateComponent<GeodeSettings> {

    var repos: MutableList<RepoEntry> = mutableListOf()
    var provider: String = "anthropic"
    var apiKey: String = ""
    var autoStartEngine: Boolean = true

    override fun getState(): GeodeSettings = this

    override fun loadState(state: GeodeSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        fun getInstance(): GeodeSettings = service()
    }
}

data class RepoEntry(var label: String = "", var path: String = "")
