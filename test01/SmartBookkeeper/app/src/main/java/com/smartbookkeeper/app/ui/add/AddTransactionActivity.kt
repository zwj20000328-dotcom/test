package com.smartbookkeeper.app.ui.add

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.widget.ArrayAdapter
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions
import com.smartbookkeeper.app.R
import com.smartbookkeeper.app.SmartBookkeeperApp
import com.smartbookkeeper.app.data.entity.PaymentSource
import com.smartbookkeeper.app.data.entity.Transaction
import com.smartbookkeeper.app.data.entity.TransactionType
import com.smartbookkeeper.app.databinding.ActivityAddTransactionBinding
import com.smartbookkeeper.app.repository.TransactionRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.*

class AddTransactionActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAddTransactionBinding
    private lateinit var repository: TransactionRepository
    private var capturedImageUri: Uri? = null
    private var tempPhotoFile: File? = null

    private val categories = listOf(
        "餐饮", "交通", "购物", "娱乐", "生活", "医疗", "教育", "住房", "通讯", "其他消费",
        "工资", "奖金", "红包", "理财", "兼职", "其他收入"
    )

    private val cameraLauncher = registerForActivityResult(
        ActivityResultContracts.TakePicture()
    ) { success ->
        if (success && capturedImageUri != null) {
            binding.ivPreview.setImageURI(capturedImageUri)
            binding.ivPreview.visibility = android.view.View.VISIBLE
            recognizeText(capturedImageUri!!)
        }
    }

    private val galleryLauncher = registerForActivityResult(
        ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            capturedImageUri = uri
            binding.ivPreview.setImageURI(uri)
            binding.ivPreview.visibility = android.view.View.VISIBLE
            recognizeText(uri)
        }
    }

    private val cameraPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) openCamera() else Toast.makeText(this, "需要相机权限", Toast.LENGTH_SHORT).show()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAddTransactionBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = TransactionRepository((application as SmartBookkeeperApp).database)

        setupUI()
    }

    private fun setupUI() {
        setSupportActionBar(binding.toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.title = "添加账单"
        binding.toolbar.setNavigationOnClickListener { finish() }

        val categoryAdapter = ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, categories)
        binding.actCategory.setAdapter(categoryAdapter)

        binding.rgType.setOnCheckedChangeListener { _, checkedId ->
            val filtered = if (checkedId == R.id.rbExpense) {
                categories.filter { !listOf("工资", "奖金", "红包", "理财", "兼职", "其他收入").contains(it) }
            } else {
                categories.filter { listOf("工资", "奖金", "红包", "理财", "兼职", "其他收入").contains(it) }
            }
            binding.actCategory.setAdapter(
                ArrayAdapter(this, android.R.layout.simple_dropdown_item_1line, filtered)
            )
        }

        binding.btnCamera.setOnClickListener { checkCameraPermissionAndOpen() }
        binding.btnGallery.setOnClickListener { galleryLauncher.launch("image/*") }

        binding.btnSave.setOnClickListener { saveTransaction() }
    }

    private fun checkCameraPermissionAndOpen() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
            == PackageManager.PERMISSION_GRANTED
        ) {
            openCamera()
        } else {
            cameraPermissionLauncher.launch(Manifest.permission.CAMERA)
        }
    }

    private fun openCamera() {
        val timeStamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(Date())
        val imageFile = File(getExternalFilesDir(Environment.DIRECTORY_PICTURES), "BILL_$timeStamp.jpg")
        tempPhotoFile = imageFile
        capturedImageUri = FileProvider.getUriForFile(this, "$packageName.fileprovider", imageFile)
        cameraLauncher.launch(capturedImageUri)
    }

    private fun recognizeText(uri: Uri) {
        binding.tvOcrResult.text = "正在识别..."
        binding.tvOcrResult.visibility = android.view.View.VISIBLE

        val image = InputImage.fromFilePath(this, uri)
        val recognizer = TextRecognition.getClient(ChineseTextRecognizerOptions.Builder().build())

        recognizer.process(image)
            .addOnSuccessListener { visionText ->
                val fullText = visionText.text
                binding.tvOcrResult.text = "识别结果:\n$fullText"

                parseBillText(fullText)
            }
            .addOnFailureListener {
                binding.tvOcrResult.text = "识别失败，请手动输入"
            }
    }

    private fun parseBillText(text: String) {
        val amountRegex = Regex("""(?:合计|总计|金额|实付|应付|小计)[：:\s]*(\d+\.?\d*)""")
        val amountMatch = amountRegex.find(text)
        if (amountMatch != null) {
            binding.etAmount.setText(amountMatch.groupValues[1])
        }

        val dateRegex = Regex("""(\d{4}[-/年]\d{1,2}[-/月]\d{1,2})""")
        val dateMatch = dateRegex.find(text)
        if (dateMatch != null) {
            binding.tvOcrResult.text = "${binding.tvOcrResult.text}\n识别到日期: ${dateMatch.groupValues[1]}"
        }
    }

    private fun saveTransaction() {
        val amountStr = binding.etAmount.text.toString().trim()
        if (amountStr.isEmpty()) {
            binding.etAmount.error = "请输入金额"
            return
        }
        val amount = amountStr.toDoubleOrNull()
        if (amount == null || amount <= 0) {
            binding.etAmount.error = "请输入有效金额"
            return
        }

        val category = binding.actCategory.text.toString().trim().ifEmpty { "其他消费" }
        val description = binding.etDescription.text.toString().trim()
        val note = binding.etNote.text.toString().trim()

        val type = if (binding.rbIncome.isChecked) TransactionType.INCOME else TransactionType.EXPENSE

        val source = when (binding.spinnerSource.selectedItemPosition) {
            0 -> PaymentSource.WECHAT
            1 -> PaymentSource.ALIPAY
            2 -> PaymentSource.BANK_CARD
            3 -> PaymentSource.CASH
            4 -> PaymentSource.CREDIT_CARD
            else -> PaymentSource.OTHER
        }

        val transaction = Transaction(
            amount = amount,
            category = category,
            description = description,
            type = type,
            paymentSource = source,
            imageUrl = capturedImageUri?.toString(),
            note = note
        )

        CoroutineScope(Dispatchers.IO).launch {
            repository.insert(transaction)
            withContext(Dispatchers.Main) {
                Toast.makeText(this@AddTransactionActivity, "保存成功", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }
}
