import { db } from './utils/firebase.js';
import { setServerStatus } from './utils/ptero.js';

export default async function handler(req, res) {
    try {
        const now = new Date();
        
        // Ambil semua langganan aktif
        const snapshot = await db.collection('active_subs').get();
        
        let suspendedCount = 0;
        let checkedCount = 0;
        const log = [];

        // Loop semua data
        // Catatan: Karena Vercel ada timeout, jika data ribuan mungkin perlu pagination.
        // Tapi untuk skala kecil-menengah ini aman.
        
        const batch = db.batch(); // Untuk update DB sekaligus

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const expiredDate = new Date(data.expiredAt);
            checkedCount++;

            // Jika Waktu Sekarang > Expired Date
            if (now > expiredDate) {
                // Cek apakah status sudah suspended di DB? (Biar gak spam API Ptero)
                if (data.status !== 'SUSPENDED') {
                    try {
                        // 1. Panggil API Ptero untuk Suspend
                        await setServerStatus(data.ptero_server_id, 'suspend');
                        
                        // 2. Update status di DB agar tidak dicek lagi besok
                        batch.update(doc.ref, { status: 'SUSPENDED' });
                        
                        log.push(`Suspend User: ${data.username} (Exp: ${data.expiredAt})`);
                        suspendedCount++;
                    } catch (err) {
                        console.error(`Gagal suspend ${data.username}:`, err.message);
                    }
                }
            }
        }

        if (suspendedCount > 0) {
            await batch.commit();
        }

        return res.status(200).json({
            success: true,
            message: `Cek Selesai. Total: ${checkedCount}, Disuspend Hari Ini: ${suspendedCount}`,
            details: log
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
