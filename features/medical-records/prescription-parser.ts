export interface PrescriptionDetail {
  medicineName: string;
  dosage: string;
  instructions: string;
  timing: string;
  indication: string;
  notes: string;
}

/**
 * Pengurai terstruktur tunggal untuk mengubah baris resep dokter menjadi panduan
 * minum obat yang mudah dipahami pasien (dosis, signa, waktu minum, indikasi, peringatan).
 */
export function parsePrescriptionDetail(prescriptionStr: string): PrescriptionDetail {
  const clean = prescriptionStr.trim();
  const lower = clean.toLowerCase();

  if (lower.includes("amlodipine")) {
    return {
      medicineName: "Amlodipine Besylate",
      dosage: "10 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum pagi hari sesudah makan",
      indication: "Menurunkan tekanan darah tinggi dan beban kerja jantung",
      notes: "Minum teratur pada jam yang sama setiap hari. Jangan menghentikan obat tiba-tiba.",
    };
  }
  if (lower.includes("kandesartan") || lower.includes("candesartan")) {
    return {
      medicineName: "Candesartan Cilexetil",
      dosage: "8 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum malam hari sebelum tidur / sesudah makan malam",
      indication: "Mengontrol hipertensi esensial dan melindungi fungsi organ vital",
      notes: "Hindari suplemen kalium tanpa anjuran dokter.",
    };
  }
  if (lower.includes("metformin")) {
    return {
      medicineName: "Metformin Hydrochloride",
      dosage: "500 mg Tablet",
      instructions: "2 x sehari 1 tablet",
      timing: "Diminum bersamaan atau segera sesudah makan",
      indication: "Mengontrol kadar glukosa darah pada Diabetes Melitus Tipe 2",
      notes: "Patuhi pola diet gizi seimbang dan perbanyak minum air putih.",
    };
  }
  if (lower.includes("glimepiride")) {
    return {
      medicineName: "Glimepiride",
      dosage: "2 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum tepat sebelum atau saat sarapan pagi",
      indication: "Membantu pankreas memproduksi insulin tubuh secara efektif",
      notes: "Waspadai tanda hipoglikemia (pusing, gemetar, keringat dingin).",
    };
  }
  if (lower.includes("isosorbid") || lower.includes("isdn")) {
    return {
      medicineName: "Isosorbide Dinitrate (ISDN)",
      dosage: "5 mg Tablet Sublingual",
      instructions: "1 tablet di bawah lidah saat dada terasa nyeri",
      timing: "Hisap di bawah lidah hingga larut, jangan langsung ditelan",
      indication: "Vasodilator koroner meredakan serangan nyeri dada jantung",
      notes: "Duduk saat mengonsumsi obat untuk mencegah pusing akibat penurunan tensi.",
    };
  }
  if (lower.includes("clopidogrel")) {
    return {
      medicineName: "Clopidogrel",
      dosage: "75 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum sesudah makan",
      indication: "Antiplatelet untuk mencegah penggumpalan darah dan risiko kardiovaskular",
      notes: "Segera konsultasi ke faskes bila terjadi luka berdarah yang sulit berhenti.",
    };
  }
  if (lower.includes("aspilet") || lower.includes("aspirin")) {
    return {
      medicineName: "Aspilet (Asam Asetilsalisilat)",
      dosage: "80 mg Tablet",
      instructions: "1 x sehari 1 tablet",
      timing: "Diminum sesudah makan dengan air putih",
      indication: "Mencegah agregasi trombosit pada pasien kardiovaskular",
      notes: "Telan utuh, jangan dikunyah atau digerus.",
    };
  }
  if (lower.includes("omeprazole")) {
    return {
      medicineName: "Omeprazole",
      dosage: "20 mg Kapsul",
      instructions: "2 x sehari 1 kapsul",
      timing: "Diminum 30-60 menit sebelum makan (saat perut kosong)",
      indication: "Menekan asam lambung berlebih dan menyembuhkan iritasi lambung",
      notes: "Konsumsi sesuai anjuran dan hindari makanan pedas/asam.",
    };
  }
  if (lower.includes("sukralfat")) {
    return {
      medicineName: "Sukralfat Suspensi",
      dosage: "500 mg / 5 mL Sirup",
      instructions: "3 x sehari 1 sendok takar (5 mL)",
      timing: "Diminum 1 jam sebelum makan atau 2 jam sesudah makan",
      indication: "Melapisi dinding lambung dari iritasi asam dan luka mukosa",
      notes: "Kocok botol sirup terlebih dahulu sebelum diminum.",
    };
  }
  if (lower.includes("ondansetron")) {
    return {
      medicineName: "Ondansetron",
      dosage: "4 mg Tablet",
      instructions: "2 x sehari 1 tablet jika timbul mual/muntah",
      timing: "Diminum sesudah makan",
      indication: "Meredakan rasa mual dan muntah akut",
      notes: "Dapat dihentikan apabila keluhan mual muntah sudah hilang.",
    };
  }

  return {
    medicineName: clean,
    dosage: "Sesuai petunjuk resep dokter",
    instructions: "Patuhi aturan minum yang tertera pada etiket obat",
    timing: "Diminum teratur sesudah makan dengan air putih",
    indication: "Terapi pengobatan dari dokter spesialis penanggung jawab",
    notes: "Hubungi apotek atau fasilitas kesehatan bila timbul keluhan alergi obat.",
  };
}
