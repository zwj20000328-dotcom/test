package com.smartbookkeeper.app.ui.home

import android.app.Application
import androidx.lifecycle.*
import com.smartbookkeeper.app.SmartBookkeeperApp
import com.smartbookkeeper.app.data.entity.Transaction
import com.smartbookkeeper.app.repository.TransactionRepository
import kotlinx.coroutines.launch
import java.util.*

class HomeViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = TransactionRepository(
        (application as SmartBookkeeperApp).database
    )

    val allTransactions: LiveData<List<Transaction>> = repository.allTransactions

    private val _currentMonthExpense = MutableLiveData<Double>()
    val currentMonthExpense: LiveData<Double> = _currentMonthExpense

    private val _currentMonthIncome = MutableLiveData<Double>()
    val currentMonthIncome: LiveData<Double> = _currentMonthIncome

    init {
        loadMonthlyStats()
    }

    private fun loadMonthlyStats() {
        val calendar = Calendar.getInstance()
        calendar.set(Calendar.DAY_OF_MONTH, 1)
        calendar.set(Calendar.HOUR_OF_DAY, 0)
        calendar.set(Calendar.MINUTE, 0)
        calendar.set(Calendar.SECOND, 0)
        val startTime = calendar.timeInMillis

        calendar.add(Calendar.MONTH, 1)
        val endTime = calendar.timeInMillis

        repository.getTotalExpense(startTime, endTime).observeForever { expense ->
            _currentMonthExpense.value = expense ?: 0.0
        }
        repository.getTotalIncome(startTime, endTime).observeForever { income ->
            _currentMonthIncome.value = income ?: 0.0
        }
    }

    fun deleteTransaction(transaction: Transaction) {
        viewModelScope.launch {
            repository.delete(transaction)
        }
    }
}
