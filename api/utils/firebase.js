import admin from 'firebase-admin';

if (!admin.apps.length) {
    try {
        // 1. Ambil Key dari Vercel
        const privateKey = process.env.FIREBASE_PRIVATE_KEY;
        
        // 2. Cek apakah Key ada?
        if (!privateKey) {
            throw new Error('FIREBASE_PRIVATE_KEY tidak ditemukan di Environment Variables!');
        }

        // 3. Bersihkan Key (Solusi Masalah \n dan Kutip)
        // Kita ganti \n literal menjadi newline asli, dan hapus tanda kutip jika ada
        const formattedKey = privateKey.replace(/\\n/g, '\n').replace(/"/g, '');

        console.log("Mencoba Login Firebase..."); // Cek di Log Vercel nanti
        
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: process.env.FIREBASE_PROJECT_ID,
                clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                privateKey: formattedKey,
            })
        });
        
        console.log("Firebase Berhasil Terhubung!"); // Jika muncul ini, berarti sukses

    } catch (error) {
        // 4. Tangkap Error biar ga Crash (500)
        console.error("GAGAL INIT FIREBASE:", error.message);
        // Kita biarkan error lanjut, tapi setidaknya sudah tercatat di log
        throw error;
    }
}

const db = admin.firestore();
export { db };
