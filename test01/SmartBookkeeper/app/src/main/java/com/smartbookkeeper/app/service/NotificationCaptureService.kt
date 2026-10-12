package com.smartbookkeeper.app.service

import android.app.Notification
import android.content.SharedPreferences
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.smartbookkeeper.app.SmartBookkeeperApp
import com.smartbookkeeper.app.data.entity.PaymentSource
import com.smartbookkeeper.app.data.entity.Transaction
import com.smartbookkeeper.app.data.entity.TransactionType
import com.smartbookkeeper.app.repository.TransactionRepository
import com.smartbookkeeper.app.util.NotificationParser
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class NotificationCaptureService : NotificationListenerService() {

    private lateinit var repository: TransactionRepository
    private lateinit var prefs: SharedPreferences

    private val supportedPackages = setOf(
        "com.tencent.mm",
        "com.eg.android.AlipayGphone",
        "com.chinamworld.main",
        "com.icbc",
        "com.android.bankabc",
        "com.chinamworld.bocmbci",
        "com.cmbchina.ccd.pluto.cmbActivity",
        "com.unionpay",
        "com.jd.jrapp",
        "com.mipay.wallet"
    )

    override fun onCreate() {
        super.onCreate()
        repository = TransactionRepository(SmartBookkeeperApp.instance.database)
        prefs = getSharedPreferences("settings", MODE_PRIVATE)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        if (!prefs.getBoolean("auto_record_enabled", true)) return

        val packageName = sbn.packageName
        if (packageName !in supportedPackages) return

        val notification = sbn.notification ?: return
        val extras = notification.extras ?: return

        val title = extras.getString(Notification.EXTRA_TITLE, "")
        val text = extras.getString(Notification.EXTRA_TEXT, "")
        val bigText = extras.getString(Notification.EXTRA_BIG_TEXT, "")

        val content = "$title $text $bigText"
        Log.d(TAG, "Notification from $packageName: $content")

        val parsed = NotificationParser.parse(packageName, content)
        if (parsed != null) {
            CoroutineScope(Dispatchers.IO).launch {
                repository.insert(parsed)
            }
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {}

    companion object {
        private const val TAG = "NotificationCapture"
    }
}
