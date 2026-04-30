package dev.geodesic.plugin.settings

import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.openapi.components.service
import com.intellij.util.xmlb.XmlSerializerUtil

@State(name = "GeodesicSettings", storages = [Storage("geodesic.xml")])
class GeodesicSettings : PersistentStateComponent<GeodesicSettings> {

    var repos: MutableList<RepoEntry> = mutableListOf()
    var provider: String = "anthropic"
    var apiKey: String = ""
    var autoStartEngine: Boolean = true

    override fun getState(): GeodesicSettings = this

    override fun loadState(state: GeodesicSettings) {
        XmlSerializerUtil.copyBean(state, this)
    }

    companion object {
        fun getInstance(): GeodesicSettings = service()
    }
}

data class RepoEntry(var label: String = "", var path: String = "")
