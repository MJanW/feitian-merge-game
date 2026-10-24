(function (root) {
  'use strict';
  // Independent garden role mapping; numbered forms in other modes are unchanged.
  const forms = {
  "sun": {
    "image": "assets/photo-00.png",
    "frame": [
      80,
      14,
      1135,
      1240
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "db225dc85c0afcb0100e198228b98d1be42a9f5013ff6e3d685da0bab6303dd2",
    "sourceImage": "0:向日葵.jpg"
  },
  "shooter": {
    "image": "assets/photo-01.png",
    "frame": [
      59,
      283,
      1139,
      794
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "4579604d704f0fbfeae00cebe8d3c280553af778a2a540529393d75d1701e115",
    "sourceImage": "2:豌豆射手.jpg"
  },
  "wall": {
    "image": "assets/photo-06.png",
    "frame": [
      0,
      77,
      1254,
      1177
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "28dcaa32d64e5a2377ff0ec5421edcba87e24f61a8930c234186b101e00f8eee",
    "sourceImage": "4:小坚果.jpg"
  },
  "ice": {
    "image": "assets/garden/ice-blue.png",
    "frame": [
      145,
      12,
      892,
      1334
    ],
    "imageSize": [
      1124,
      1399
    ],
    "imageHash": "81f8f536aa9a95bec10523a8dabea3f08e8777730ef5481eec8ee96b2eb35e83",
    "sourceImage": "codex-clipboard-e754060e-ecd6-449b-b295-67efd0d55b99.jpg",
    "subject": "蓝衣人物（单人）"
  },
  "burst": {
    "image": "assets/garden/new-77.png",
    "frame": [
      9,
      8,
      1359,
      1137
    ],
    "imageSize": [
      1374,
      1145
    ],
    "imageHash": "4bbe99b02c7c41971c0839dbd898d920ece956e90d6b0fa2e2e67d995bef928c",
    "sourceImage": "Weixin Image_20261022144001_77.jpg"
  },
  "bomb": {
    "image": "assets/garden/new-81.png",
    "frame": [
      240,
      33,
      626,
      1439
    ],
    "imageSize": [
      1045,
      1505
    ],
    "imageHash": "793701d230b33d0d1a96663954b379dbaf9afcc380d57c3c2b2100cd3c852f63",
    "sourceImage": "Weixin Image_20261022144001_81.jpg"
  },
  "mower": {
    "image": "assets/photo-10.png",
    "frame": [
      169,
      60,
      1053,
      1160
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "4cebab27fef1d05aa640a1eae07861da7233c1fc07b0941f7179008f59749458",
    "sourceImage": "10:小推车.jpg"
  },
  "star": {
    "image": "assets/garden/star-shooter.png",
    "frame": [
      23,
      169,
      1044,
      1093
    ],
    "imageSize": [
      1086,
      1448
    ],
    "imageHash": "883c5dccc9e32df64cea695d6caa44e4b5df96292f09b1c5ce37b8d98e93333d",
    "sourceImage": "星星射手.jpg"
  },
  "corn": {
    "image": "assets/photo-02.png",
    "frame": [
      14,
      173,
      1231,
      989
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "9a78bc83953447e8af9031bbfbc729188b880064ff21c0f37c61d5b81ead43de",
    "sourceImage": "1:玉米投手.jpg"
  },
  "tallwall": {
    "image": "assets/photo-minus-one.png",
    "frame": [
      173,
      58,
      681,
      1435
    ],
    "imageSize": [
      1024,
      1536
    ],
    "imageHash": "4c81627d659b0c2b5777e124fc8a5be60b79581e9f5c9e55d4a6b54d28eb404e",
    "sourceImage": "-1:高坚果.jpg"
  },
  "torch": {
    "image": "assets/photo-09-v2.png",
    "frame": [
      280,
      0,
      945,
      1254
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "4bfbd73a1b0dcff4a17350d68ef9181e20d2337beea9cb17f6d9c934d3296aab",
    "sourceImage": "9:火炬.jpg"
  },
  "cannon": {
    "image": "assets/photo-04.png",
    "frame": [
      26,
      113,
      1220,
      1116
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "402b3df480ab204b99935744efb16d93cf6296fa021cd0cb6869fcca23b59d6a",
    "sourceImage": "5:玉米加农炮.jpg"
  },
  "lightning": {
    "image": "assets/garden/new-80.png",
    "imageSize": [
      1086,
      1448
    ],
    "frame": [
      7,
      67,
      1078,
      1381
    ],
    "imageHash": "e066ee620e9d26d0d546e3ef7a6d2e522b833f37472a5636501664d3b7b6c80e",
    "sourceImage": "Weixin Image_20261022144001_80.jpg"
  },
  "lily": {
    "image": "assets/garden/lily-float.png",
    "frame": [
      63,
      118,
      1376,
      833
    ],
    "imageSize": [
      1536,
      1024
    ],
    "imageHash": "fa735d8256027ef86badd862eee1f1ce9c2a1f3031fd95bdf0e8677e62ab63ed",
    "sourceImage": "codex-clipboard-189f1560-31ba-4b41-b7d9-db84c23d8f93.jpg",
    "subject": "躺卧灰袖蓝衣人物，保留蓝色手机与棕鞋"
  },
  "kelp": {
    "image": "assets/garden/kelp-sleeper.png",
    "frame": [
      45,
      11,
      1020,
      1437
    ],
    "imageSize": [
      1086,
      1448
    ],
    "imageHash": "40387da84f82ac8790614bee704f8912c891d1593a6786ea5af3a42dba4eac3d",
    "sourceImage": "codex-clipboard-35449e72-e318-4b6b-b587-8cefa270ba7d.jpg",
    "subject": "蜷卧蓝衣人物，保留本人黑鞋"
  },
  "cactus": {
    "image": "assets/garden/cactus-turn.png",
    "frame": [
      325,
      59,
      667,
      1285
    ],
    "imageSize": [
      1152,
      1366
    ],
    "imageHash": "35809985654cfd43a16a715e734c2a71451d9bc2dbfd1365f9964066c0e32db2",
    "sourceImage": "codex-clipboard-4d03771b-16ae-4bfb-a9d5-0b683723a7db.jpg",
    "subject": "灰衣转身人物，上身至短裤"
  },
  "tide": {
    "image": "assets/garden/tide-reader.png",
    "frame": [
      218,
      49,
      1262,
      964
    ],
    "imageSize": [
      1536,
      1024
    ],
    "imageHash": "baa4539ab7eabc7a59770bffeeff34a435bce6044d4faa07f77bdceba1d1b8e0",
    "sourceImage": "codex-clipboard-0f12a780-5c24-455c-bd00-6819d9e2eedf.jpg",
    "subject": "蓝衣平板人物，上身与手持平板"
  }
};
  for (const form of Object.values(forms)) { Object.freeze(form.frame); Object.freeze(form.imageSize); Object.freeze(form); }
  root.GardenForms = Object.freeze(forms);
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GardenForms;
})(typeof window !== 'undefined' ? window : globalThis);
