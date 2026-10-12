package com.smartbookkeeper.app.ui.adapter

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.smartbookkeeper.app.data.entity.PaymentSource
import com.smartbookkeeper.app.data.entity.Transaction
import com.smartbookkeeper.app.data.entity.TransactionType
import com.smartbookkeeper.app.databinding.ItemTransactionBinding
import java.text.SimpleDateFormat
import java.util.*

class TransactionAdapter : ListAdapter<Transaction, TransactionAdapter.ViewHolder>(DiffCallback) {

    class ViewHolder(val binding: ItemTransactionBinding) : RecyclerView.ViewHolder(binding.root)

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemTransactionBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val item = getItem(position)
        with(holder.binding) {
            tvCategory.text = item.category
            tvDescription.text = item.description.ifEmpty { item.category }

            val amountText = if (item.type == TransactionType.EXPENSE) {
                String.format("-¥%.2f", item.amount)
            } else {
                String.format("+¥%.2f", item.amount)
            }
            tvAmount.text = amountText
            tvAmount.setTextColor(
                if (item.type == TransactionType.EXPENSE) 0xFFE53935.toInt() else 0xFF43A047.toInt()
            )

            val sdf = SimpleDateFormat("MM/dd HH:mm", Locale.getDefault())
            tvDate.text = sdf.format(Date(item.timestamp))

            tvSource.text = when (item.paymentSource) {
                PaymentSource.WECHAT -> "微信"
                PaymentSource.ALIPAY -> "支付宝"
                PaymentSource.BANK_CARD -> "银行卡"
                PaymentSource.CASH -> "现金"
                PaymentSource.CREDIT_CARD -> "信用卡"
                PaymentSource.OTHER -> "其他"
            }

            val badgeText = if (item.isAutoRecorded) "自动" else "手动"
            tvBadge.text = badgeText
            tvBadge.setBackgroundResource(
                if (item.isAutoRecorded) 0xFF4CAF50.toInt() else 0xFF9E9E9E.toInt()
            )
        }
    }

    fun getItemAt(position: Int): Transaction = getItem(position)

    companion object DiffCallback : DiffUtil.ItemCallback<Transaction>() {
        override fun areItemsTheSame(old: Transaction, new: Transaction) = old.id == new.id
        override fun areContentsTheSame(old: Transaction, new: Transaction) = old == new
    }
}
