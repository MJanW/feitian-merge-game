(function (root) {
  'use strict';
  // Independent garden role mapping: other game modes retain their numbered forms.
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
    "image": "assets/photo-07.png",
    "frame": [
      128,
      47,
      1006,
      1180
    ],
    "imageSize": [
      1254,
      1254
    ],
    "imageHash": "0e2e0a984218fab5030790db0b1117d4d09315c85c48407c7a52804e0a524d12",
    "sourceImage": "6:寒冰射手.jpg"
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
  }
};
  for (const form of Object.values(forms)) { Object.freeze(form.frame); Object.freeze(form.imageSize); Object.freeze(form); }
  root.GardenForms = Object.freeze(forms);
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GardenForms;
})(typeof window !== 'undefined' ? window : globalThis);
