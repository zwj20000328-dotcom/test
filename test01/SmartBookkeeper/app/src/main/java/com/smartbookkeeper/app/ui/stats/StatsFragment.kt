package com.smartbookkeeper.app.ui.stats

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import com.smartbookkeeper.app.SmartBookkeeperApp
import com.smartbookkeeper.app.databinding.FragmentStatsBinding
import com.smartbookkeeper.app.repository.TransactionRepository
import java.util.*

class StatsFragment : Fragment() {

    private var _binding: FragmentStatsBinding? = null
    private val binding get() = _binding!!

    private lateinit var repository: TransactionRepository

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentStatsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        repository = TransactionRepository((requireActivity().application as SmartBookkeeperApp).database)
        loadStats()
    }

    private fun loadStats() {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        val startTime = calendar.timeInMillis

        calendar.add(Calendar.MONTH, 1)
        val endTime = calendar.timeInMillis

        repository.getTotalExpense(startTime, endTime).observe(viewLifecycleOwner) { expense ->
            binding.tvTotalExpense.text = String.format("本月支出: ¥%.2f", expense ?: 0.0)
        }

        repository.getTotalIncome(startTime, endTime).observe(viewLifecycleOwner) { income ->
            binding.tvTotalIncome.text = String.format("本月收入: ¥%.2f", income ?: 0.0)
        }

        repository.getExpenseByCategory(startTime, endTime).observe(viewLifecycleOwner) { categories ->
            val sb = StringBuilder()
            categories.forEach { ct ->
                sb.appendLine("${ct.category}: ¥${String.format("%.2f", ct.total)}")
            }
            binding.tvCategoryStats.text = if (sb.isNotEmpty()) sb.toString() else "暂无数据"
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
