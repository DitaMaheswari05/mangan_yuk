-- Melengkapi data tenant (pois) yang sebelumnya bertanda TODO di seed.sql:
--   1. is_halal = true untuk tenant yang tidak punya menu berbahan babi, kodok, atau alkohol
--      (tenant non-halal sudah diisi false di seed).
--   2. zone = 'Sudirman Street' untuk semua tenant (belum ada pembagian zona).
--   3. description = ringkasan informatif dari transkrip audio (content/transcripts/pXX.md).
-- seed.sql ikut diperbarui dengan nilai yang sama, supaya db reset menghasilkan data yang identik.

update public.pois
set is_halal = true
where id in ('P01', 'P04', 'P07', 'P09', 'P10', 'P11', 'P13', 'P16', 'P17', 'P22', 'P27', 'P28', 'P29')
  and is_halal is null;

update public.pois
set zone = 'Sudirman Street'
where zone = 'TODO';

update public.pois as p
set description = v.description
from (
  values
  ('P01', 'Kedai gorengan khas Pontianak, Kalimantan Barat. Andalannya pisang goreng kipas: pisang diiris tipis tanpa putus hingga terbuka seperti kipas, lalu digoreng dengan tepung renyah. Tersedia juga bakwan Pontianak, pisang tanduk madu, tape goreng madu, nanas goreng, bom singkong, tahu isi, dan gandasturi isi kacang hijau.'),
  ('P03', 'Kedai swike, masakan peranakan Tionghoa berbahan kodok. Namanya berasal dari bahasa Hokkien sui ke yang berarti ayam air. Andalannya kodok goreng mentega dan kodok goreng tepung, dengan varian rica-rica dan asam manis, serta swike kuah tauco versi klasik.'),
  ('P04', 'Kedai bebek goreng bumbu hitam khas Madura. Bumbunya dari rempah yang dimasak lama hingga gelap dan pekat, sehingga dagingnya gurih, sedikit pedas, dan meresap. Tersedia paket nasi bebek ukuran biasa dan kecil, serta ayam goreng bumbu hitam, termasuk versi pedas.'),
  ('P05', 'Kedai nasi campur olahan babi. Andalannya nasi campur hainan, yaitu nasi yang dimasak dengan kaldu, jahe, dan bawang putih, dengan lauk seperti samcan (perut babi tiga lapis) dan charsiu (babi panggang khas Kanton). Ada juga nasi samcan crispy sambal matah, nasi samcan lada garam, dan nasi goreng Pigbull.'),
  ('P06', 'Kedai kwetiau goreng khas Pematang Siantar dan Medan, Sumatera Utara, yang dimasak di atas api besar hingga beraroma smoky (wok hei). Tersedia juga ayam kampung pek cam ke, yaitu ayam rebus ala Tionghoa dengan saus jahe, serta chicken rice, bubur, dan dimsum. Ayam bisa dipesan setengah hingga satu ekor.'),
  ('P07', 'Kedai Chinese food ala Indonesia. Pilihannya meliputi bakmie kepiting, mie hokkian, misua kuah, kwetiau dan bihun goreng, capcay, hingga nasi goreng, dengan pilihan ayam, sapi, atau seafood. Cocok untuk memesan beberapa menu dan menikmatinya bersama.'),
  ('P08', 'Kedai bak kut teh dan olahan babi bergaya Kalimantan. Bak kut teh (bahasa Hokkien: teh tulang daging) adalah sup iga babi yang direbus lama dengan rempah dan herbal; namanya merujuk pada kebiasaan menyantapnya bersama teh. Pilihannya antara lain bakut sayur asin, bakut perut ikan, bak kut angkhak merah, kolo mie bakut ala Sarawak, dan kaki babi angkhak.'),
  ('P09', 'Kedai soto dan sop dari berbagai daerah. Andalannya soto Bandung berkuah bening dengan daging sapi, lobak, dan kacang kedelai goreng. Tersedia juga soto Lamongan, soto Betawi, sop iga, sop buntut, serta gurame pesmol khas Sunda dan gurame bakar.'),
  ('P10', 'Kedai hidangan claypot yang dimasak dan disajikan dalam panci tanah liat agar tetap hangat. Pilihannya chicken, beef, seafood, kimchi, udang pete, dan cumi cabe hijau claypot. Andalannya puding peach gum, getah pohon persik yang bertekstur bening dan kenyal, serta aneka puding seperti cokelat, wintermelon, dan almond.'),
  ('P11', 'Kedai masakan Jepang. Andalannya gyuniku amakara donburi, nasi dengan irisan daging sapi berbumbu manis pedas. Tersedia juga salmon amakara donburi, salmon shioyaki, hibiki gyudon, tori katsu, tsuya karaage, nagoya tebasaki, dan tamagoyaki.'),
  ('P12', 'Kedai bak kut teh dan samcan. Bak kut teh di sini bergaya Singapura, berkuah bening dengan rasa lada putih yang hangat, tersedia dalam ukuran reguler dan besar. Pilihan lainnya bak kut teh pork loin yang lebih banyak daging, bak kut sayur asin, dan mie bak kut teh.'),
  ('P13', 'Kedai baso goreng dari ikan tenggiri, renyah di luar dan lembut di dalam. Tersedia porsi isi 4, 6, atau 8–10 biji untuk disantap di tempat, serta baso goreng beku lengkap dengan sambal untuk dibawa pulang.'),
  ('P14', 'Kedai olahan nasi dan bakmie babi dengan lebih dari 30 pilihan menu. Andalannya nasi segulung babi dan nasi babi banjur bawang, yaitu babi yang disiram minyak bawang. Ada juga nasi babi hong, bakmie babi, bakmie cukiok kaki babi, nasi campur babi empat musim, dan sosis siluman babi.'),
  ('P15', 'Kedai bacuk, olahan babi cincang berbumbu gurih yang disajikan dengan nasi putih atau sebagai nasi goreng. Andalannya nasi goreng bacuk putih dan nasi bacuk original. Tersedia juga babi tore khas Manado dengan sambal matah, babi madu, nasi goreng babi madu asin, serta kwetiau goreng bacuk dan babi tore.'),
  ('P16', 'Meski namanya seperti kedai minuman, andalan Hau’s Tea adalah cakue, adonan dua batang yang digoreng hingga mengembang dan renyah. Variasinya antara lain cakue bumbu, rujak, udang, chili dog, dan sprinkle. Tersedia juga baso campur, baso goreng, chickenball, chicken stick, batagor, dan mie kocok.'),
  ('P17', 'Kedai kuo tie (guotie), pangsit yang dimasak menempel di wajan datar. Ada dua pilihan: original (pan fried) dengan dasar renyah dan kulit atas lembut, serta crispy (deep fried) yang garing di seluruh sisi. Bisa dibeli satuan atau satu porsi isi 10, nikmat dicocol saus cuka atau sambal.'),
  ('P18', 'Kedai nasi goreng babi dengan berbagai topping. Andalannya nasi goreng topping chasiu (babi panggang manis khas Kanton) dan topping samcan goreng renyah. Tersedia juga topping campur samcan, chasiu, dan lapchiong, serta nasi goreng yang chou ala Yangzhou.'),
  ('P19', 'Kedai kopi dengan andalan Jazz Coffee Latte dan Orange Espresso Tonic (espresso, air tonik, dan jeruk). Ada juga hazelnut jazz coffee, brown sugar latte, caramel macchiato, americano, dan matcha latte, serta lemonade stroberi dan minuman serai untuk yang tidak minum kopi. Beberapa menu mengandung alkohol, seperti Rhum dan Baileys Jazz Coffee.'),
  ('P20', 'Kedai nasi campur dengan andalan nasi hainan komplit dan nasi putih komplit. Toppingnya ayam panggang, chasiu, siobak (babi panggang berkulit renyah), dan lapchiong. Ayam panggang Kencana 99 juga bisa dibeli terpisah untuk dibawa pulang.'),
  ('P21', 'Kedai kwetiau bakar dan nasi goreng. Andalannya kwetiau bakar dengan aroma smoky yang khas. Pilihan nasi gorengnya beragam: smoked chicken, Yangzhou ayam atau babi, seafood, bacon, lapchiong, hingga samcan. Tersedia pilihan ayam dan seafood, tetapi dapurnya juga mengolah babi.'),
  ('P22', 'Kedai minuman susu dengan banyak pilihan rasa. Andalannya Darmi Lychee, susu rasa leci yang manis dan segar. Rasa lainnya antara lain green tea, choco oat, regal, keju, cadbury, moka, anggur, taro, pisang, dan plain.'),
  ('P23', 'Kedai bir dan koktail. Tersedia bir lokal seperti Bintang hingga bir impor seperti Heineken dan König Ludwig dalam ukuran pint maupun quart, serta koktail seperti Long Island. Seluruh menu beralkohol dan hanya untuk pengunjung berusia 21 tahun ke atas.'),
  ('P25', 'Kedai masakan khas Medan, Sumatera Utara. Empat menu andalannya bakmie Medan dengan kuah terpisah, hainan babi, kwetiau goreng, dan mie goreng Medan yang dimasak di atas api besar. Tersedia juga bihun goreng, sop iga babi, bakut sayur asin, capcay babi, serta nasi goreng samcan dan lapchiong.'),
  ('P26', 'Kedai mie dengan lebih dari 40 pilihan menu. Andalannya soto mie Sukabumi berisi mi kuning, kol, tomat, dan daging dalam kuah kaldu gurih. Ada juga mie yamin asin atau manis dengan topping bakut, bakso, samcan, atau charsiu, serta bakmi campur, bakmi kekian, dan soto bihun.'),
  ('P27', 'Kedai jus dan es buah. Andalannya jus stroberi jeruk, jus nanas jeruk, dan es campur. Tersedia aneka jus buah tunggal maupun campuran, sop buah, paket couple seperti mango delight dan strawberry delight, serta paket pempek beku.'),
  ('P28', 'Kedai pempek khas Palembang dari ikan giling dan sagu, disajikan dengan cuko yang manis, asam, dan pedas. Andalannya pempek kapal selam besar berisi telur utuh. Tersedia juga pempek lenggang, kulit, lenjer, adaan, keriting, tekwan, dan paket rame rame untuk rombongan.'),
  ('P29', 'Kedai mie berkuah susu yang creamy. Andalannya mie susu ayam original, dengan pilihan lain mie susu udang bakar dan soto susu sapi dengan nasi. Untuk penutup tersedia ronde, bola ketan isi kacang dalam kuah jahe hangat, dengan varian gula putih, gula merah, susu original, dan susu ubi keju.'),
  ('P30', 'Kedai samcan, daging perut babi tiga lapis yang digoreng renyah. Andalannya nasi samcan goreng sambal matah, nasi samcan goreng cabe garam, dan paket nasi samcan hemat untuk berdua. Varian bumbu lainnya mentega, kecap, telur asin, dan mayones.'),
  ('P31', 'Kedai bacang, nasi atau ketan berisi daging yang dibungkus daun bambu lalu direbus. Andalannya bacang beras babi yang lebih pulen dan bacang ketan babi yang lebih kenyal. Tersedia juga bakpao babi isi telur, lapchiong, dan jamur hioko, aneka roti, serta liang tea.'),
  ('P32', 'Kedai sate babi yang dijual per tusuk. Andalannya sate samcan asin yang dibakar hingga lemaknya meleleh dan bagian luarnya garing. Pilihan lainnya sate kulit babi, sate babi manis mini, sate babi besar sambal matah, dan sate samcan shaokao berbumbu jintan dan cabai kering, dengan tambahan nasi mix.'),
  ('P33', 'Kedai bernuansa Meksiko dan Amerika Latin. Andalannya cubanos, sandwich isi babi panggang, ham, keju, acar, dan mustard yang dipanggang sambil ditekan, serta Uncle Joe’s Porky Plate. Ada juga nasi samcan panggang bumbu Meksiko dan cheese whiz.')
) as v(id, description)
where p.id = v.id;
