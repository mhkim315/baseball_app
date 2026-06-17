package kr.fullcount.app

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class LiveScoreModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "LiveScoreModule"
    }

    @ReactMethod
    fun startService() {
        try {
            val intent = Intent(reactContext, LiveScoreService::class.java)
            intent.action = "START_SERVICE"
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent)
            } else {
                reactContext.startService(intent)
            }
        } catch (e: Exception) {
            // Android 12+ blocks startForegroundService from background (after force-stop)
            // User must open the app once before widget REFRESH will work
            android.util.Log.w("LiveScoreModule", "Cannot start service from background", e)
        }
    }

    @ReactMethod
    fun stopService() {
        val intent = Intent(reactContext, LiveScoreService::class.java)
        reactContext.stopService(intent)
    }
}
