package com.smartbookkeeper.app.data.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

enum class TransactionType {
    EXPENSE, INCOME
}

enum class PaymentSource {
    WECHAT, ALIPAY, BANK_CARD, CASH, CREDIT_CARD, OTHER
}

@Entity(tableName = "transactions")
data class Transaction(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val amount: Double,
    val category: String,
    val description: String = "",
    val type: TransactionType = TransactionType.EXPENSE,
    val paymentSource: PaymentSource = PaymentSource.OTHER,
    val timestamp: Long = System.currentTimeMillis(),
    val imageUrl: String? = null,
    val isAutoRecorded: Boolean = false,
    val note: String = ""
)
