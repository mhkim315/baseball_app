package kr.fullcount.app.test

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import com.facebook.react.HeadlessJsTaskService

class LiveScoreService : Service() {
    private val CHANNEL_ID = "LiveScoreChannel"
    private var bgThread: HandlerThread? = null
    private var handler: Handler? = null
    private var runnable: Runnable? = null
    private var isRunning = false

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP_SERVICE") {
            stopSelf()
            return START_NOT_STICKY
        }

        val stopIntent = Intent(this, LiveScoreService::class.java).apply {
            action = "STOP_SERVICE"
        }
        val stopPendingIntent = android.app.PendingIntent.getService(
            this, 0, stopIntent, android.app.PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Live Score Mode")
            .setContentText("Updating scores in real-time...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .addAction(android.R.drawable.ic_delete, "Stop", stopPendingIntent)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(1001, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        } else {
            startForeground(1001, notification)
        }

        if (!isRunning) {
            isRunning = true
            startPolling()
        }

        return START_STICKY
    }

    private fun startPolling() {
        bgThread = HandlerThread("LiveScorePolling").apply { start() }
        handler = Handler(bgThread!!.looper)
        runnable = object : Runnable {
            override fun run() {
                if (!isRunning) return
                
                val serviceIntent = Intent(applicationContext, LiveScoreTaskService::class.java)
                applicationContext.startService(serviceIntent)
                HeadlessJsTaskService.acquireWakeLockNow(applicationContext)
                
                // Poll every 5 seconds (5000 ms)
                handler?.postDelayed(this, 5000)
            }
        }
        handler?.post(runnable!!)
    }

    override fun onDestroy() {
        super.onDestroy()
        isRunning = false
        handler?.removeCallbacksAndMessages(null)
        bgThread?.quitSafely()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val serviceChannel = NotificationChannel(
                CHANNEL_ID,
                "Live Score Service Channel",
                NotificationManager.IMPORTANCE_LOW
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(serviceChannel)
        }
    }
}
