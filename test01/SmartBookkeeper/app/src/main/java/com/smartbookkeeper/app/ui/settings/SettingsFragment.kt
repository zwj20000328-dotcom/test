package com.smartbookkeeper.app.ui.settings

import android.content.ComponentName
import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import com.smartbookkeeper.app.databinding.FragmentSettingsBinding
import com.smartbookkeeper.app.service.NotificationCaptureService

class SettingsFragment : Fragment() {

    private var _binding: FragmentSettingsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentSettingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val prefs = requireContext().getSharedPreferences("settings", android.content.Context.MODE_PRIVATE)
        binding.switchAutoRecord.isChecked = prefs.getBoolean("auto_record_enabled", true)

        binding.switchAutoRecord.setOnCheckedChangeListener { _, isChecked ->
            prefs.edit().putBoolean("auto_record_enabled", isChecked).apply()
        }

        binding.btnOpenNotificationAccess.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            Toast.makeText(requireContext(), "请开启「智能记账」的通知访问权限", Toast.LENGTH_LONG).show()
        }

        binding.btnCheckPermission.setOnClickListener {
            val cn = ComponentName(requireContext(), NotificationCaptureService::class.java)
            val flat = Settings.Secure.getString(requireContext().contentResolver, "enabled_notification_listeners")
            val isEnabled = flat != null && flat.contains(cn.flattenToString())
            if (isEnabled) {
                Toast.makeText(requireContext(), "通知权限已开启", Toast.LENGTH_SHORT).show()
            } else {
                Toast.makeText(requireContext(), "通知权限未开启，请先授权", Toast.LENGTH_LONG).show()
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
