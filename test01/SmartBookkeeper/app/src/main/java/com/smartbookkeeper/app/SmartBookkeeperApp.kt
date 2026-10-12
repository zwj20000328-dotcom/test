package com.smartbookkeeper.app

import android.app.Application
import com.smartbookkeeper.app.data.AppDatabase

class SmartBookkeeperApp : Application() {

    val database: AppDatabase by lazy { AppDatabase.getInstance(this) }

    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: SmartBookkeeperApp
            private set
    }
}
