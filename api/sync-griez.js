import crypto from 'crypto';

export default async function handler(req, res) {
    const GRIEZ_API_ID = process.env.GRIEZ_API_ID;
    const GRIEZ_API_KEY = process.env.GRIEZ_API_KEY;
    const URL_SERVICE = "https://griezstore.id/api/service";

    if (!GRIEZ_API_ID || !GRIEZ_API_KEY) {
        return res.status(500).json({ error: "API Key belum disetting" });
    }

    try {
        const sign = crypto.createHash('md5').update(GRIEZ_API_ID + GRIEZ_API_KEY).digest('hex');
        
        const payload = new URLSearchParams();
        payload.append('api_id', GRIEZ_API_ID);
        payload.append('api_key', GRIEZ_API_KEY);
        payload.append('signature', sign);
        payload.append('status', 'active');

        const reqGriez = await fetch(URL_SERVICE, { method: 'POST', body: payload });
        const resGriez = await reqGriez.json();

        // CEK 1: Apakah Griez menolak koneksi?
        if (!resGriez.status || !resGriez.data) {
            return res.status(500).json({ 
                error: "Gagal ambil data Griez", 
                respon_asli: resGriez 
            });
        }

        // CEK 2: Data ada, tapi kosong?
        if (resGriez.data.length === 0) {
            return res.status(200).json({ 
                success: false, 
                message: "GriezStore mengembalikan data kosong (0 produk)." 
            });
        }

        // CEK 3: AMBIL SAMPEL KATEGORI & NAMA (DETEKTIF MODE)
        // Kita ambil semua nama kategori unik untuk dilihat
        const categoriesFound = new Set();
        const sampleProducts = [];

        // Ambil 10 produk pertama sebagai contoh
        for (let i = 0; i < Math.min(resGriez.data.length, 10); i++) {
            const item = resGriez.data[i];
            categoriesFound.add(item.kategori); // Catat kategorinya
            sampleProducts.push({
                nama: item.nama_layanan,
                kategori: item.kategori,
                id: item.id
            });
        }
        
        // Loop semua data cuma buat catat kategori unik lainnya
        resGriez.data.forEach(item => {
            if(item.kategori) categoriesFound.add(item.kategori);
        });

        // TAMPILKAN HASILNYA KE LAYAR
        return res.status(200).json({
            success: true,
            message: "MODE DEBUG: Lihat data di bawah ini untuk memperbaiki filter.",
            total_produk_griez: resGriez.data.length,
            daftar_kategori_ditemukan: Array.from(categoriesFound), // <--- INI YG KITA CARI
            contoh_produk: sampleProducts
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
