import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const { game, id, zone } = req.body;

    if (!id || !zone) {
        return res.status(400).json({ error: 'ID & Zone dibutuhkan' });
    }

    // KONFIGURASI API CEK NICKNAME
    // Masukkan kredensial GriezStore / Provider lain disini
    const API_ID = process.env.GRIEZ_API_ID;
    const API_KEY = process.env.GRIEZ_API_KEY;
    
    // URL Cek ID Griez (CONTOH: Sesuaikan dengan dokumentasi Griez yang Anda punya)
    // Biasanya formatnya: https://griezstore.id/api/merchant/v1/h2h/get-profile 
    // Atau bisa jadi endpoint berbeda. Cek dokumentasi bagian "Cek ID Game".
    const URL_CHECK = "https://griezstore.id/api/merchant/cek-game"; 

    try {
        const sign = crypto.createHash('md5').update(API_ID + API_KEY).digest('hex');

        // Payload (Sesuaikan dengan Docs Griez)
        const payload = new URLSearchParams();
        payload.append('api_id', API_ID);
        payload.append('api_key', API_KEY);
        payload.append('game', 'mobilelegend'); // Sesuaikan kode game di Griez
        payload.append('user_id', id);
        payload.append('zone_id', zone);

        const apiReq = await fetch(URL_CHECK, {
            method: 'POST',
            body: payload
        });

        const apiRes = await apiReq.json();

        if (apiRes.status === false || !apiRes.data) {
            return res.status(400).json({ error: apiRes.data || "User tidak ditemukan" });
        }

        // Jika Sukses
        return res.status(200).json({
            success: true,
            nickname: apiRes.data.username || apiRes.data.nickname // Sesuaikan field responnya
        });

    } catch (error) {
        console.error("Cek Nick Error:", error);
        // Simulasi sukses untuk testing (HAPUS INI JIKA SUDAH LIVE)
        // return res.status(200).json({ success: true, nickname: "TestingUser" });
        
        return res.status(500).json({ error: "Gagal cek server." });
    }
}
