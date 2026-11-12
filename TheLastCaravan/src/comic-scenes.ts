export const comicArt = [
  'forest',
  'family',
  'vial',
  'trade',
  'axle',
  'letter',
  'mountains',
  'sleet',
  'river',
  'ash',
  'watch',
  'cask',
] as const;
type Art = (typeof comicArt)[number];
type Scene = { art: readonly [Art, Art, Art]; en: string; fa: string };
export const comicScenes: Record<string, Scene> = {
  merchant: {
    art: ['forest', 'axle', 'trade'],
    en: 'If that axle holds, I can get the wagon home.',
    fa: 'اگر این محور دوام بیاورد، گاری را به خانه می‌رسانم.',
  },
  child: {
    art: ['forest', 'family', 'vial'],
    en: 'Is there anything you can spare?',
    fa: 'چیزی دارید که بتوانید به ما بدهید؟',
  },
  toll: {
    art: ['forest', 'watch', 'trade'],
    en: 'Pay the toll and the road is yours.',
    fa: 'باج را بدهید تا راه برایتان باز شود.',
  },
  wheel: {
    art: ['forest', 'axle', 'sleet'],
    en: 'It won’t take another turn like that.',
    fa: 'یک چرخش دیگر مثل این را تاب نمی‌آورد.',
  },
  frost: {
    art: ['mountains', 'sleet', 'watch'],
    en: 'The shelf is close. We have to move.',
    fa: 'صخره نزدیک است. باید راه بیفتیم.',
  },
  cache: {
    art: ['forest', 'axle', 'vial'],
    en: 'Somebody meant this to be found.',
    fa: 'کسی خواسته اینجا را پیدا کنند.',
  },
  ford: {
    art: ['forest', 'river', 'sleet'],
    en: 'The river’s higher than the rope was set for.',
    fa: 'آب بالاتر از جایی آمده که طناب را بسته‌اند.',
  },
  bread: {
    art: ['forest', 'trade', 'cask'],
    en: 'A drink would get us to the next stop.',
    fa: 'جرعه‌ای آب ما را به منزل بعد می‌رساند.',
  },
  ash: {
    art: ['ash', 'axle', 'sleet'],
    en: 'I can see iron through the smoke.',
    fa: 'از میان دود آهن را می‌بینم.',
  },
  grave: {
    art: ['forest', 'watch', 'letter'],
    en: 'Someone should know they were here.',
    fa: 'باید کسی بداند که آن‌ها اینجا بوده‌اند.',
  },
  lantern: {
    art: ['forest', 'watch', 'cask'],
    en: 'Water for trade. A place by the fire would do, too.',
    fa: 'آب برای دادوستد دارم. جایی کنار آتش هم خوب است.',
  },
  berries: {
    art: ['forest', 'trade', 'sleet'],
    en: 'Look at the tracks under the fence.',
    fa: 'ردپاهای زیر حصار را ببینید.',
  },
  bell: {
    art: ['forest', 'watch', 'axle'],
    en: 'Did you hear somebody answer?',
    fa: 'شنیدید کسی جواب بدهد؟',
  },
  wolves: {
    art: ['forest', 'sleet', 'watch'],
    en: 'Keep the fire between us and the trees.',
    fa: 'آتش را میان ما و درخت‌ها نگه دارید.',
  },
  ice: {
    art: ['mountains', 'sleet', 'axle'],
    en: 'Once it starts sliding, we can’t stop it.',
    fa: 'وقتی سُر بخورد، دیگر نمی‌توانیم نگهش داریم.',
  },
  cairn: {
    art: ['mountains', 'watch', 'vial'],
    en: 'They left this for the next traveler.',
    fa: 'این را برای مسافر بعدی گذاشته‌اند.',
  },
  rope: {
    art: ['mountains', 'river', 'sleet'],
    en: 'People can cross up here. The wagon has to go below.',
    fa: 'آدم‌ها از این بالا می‌گذرند. گاری باید از پایین برود.',
  },
  snow: {
    art: ['mountains', 'watch', 'letter'],
    en: 'There’s enough room if we sit close.',
    fa: 'اگر نزدیک هم بنشینیم، برای همه جا هست.',
  },
  waterline: {
    art: ['ash', 'cask', 'trade'],
    en: 'Everyone gets a turn while the pump holds.',
    fa: 'تا تلمبه کار می‌کند، به همه نوبت می‌رسد.',
  },
  dust: {
    art: ['ash', 'sleet', 'cask'],
    en: 'The wall will hold. The dust will get through.',
    fa: 'دیوار دوام می‌آورد. غبار از آن می‌گذرد.',
  },
  'salt-road': {
    art: ['ash', 'trade', 'vial'],
    en: 'I’ve two skins. Have you anything for this cut?',
    fa: 'دو مشک دارم. چیزی برای این زخم دارید؟',
  },
  'city-fire': {
    art: ['ash', 'watch', 'letter'],
    en: 'There’s room by the pot if you’re hungry.',
    fa: 'اگر گرسنه‌اید، کنار دیگ جا هست.',
  },
  letters: {
    art: ['forest', 'watch', 'letter'],
    en: 'Someone wrote these expecting an answer.',
    fa: 'کسی این‌ها را نوشته و منتظر جواب بوده است.',
  },
  'lantern-oil': {
    art: ['forest', 'watch', 'axle'],
    en: 'We’ll need a light before the road drops.',
    fa: 'پیش از سرازیری به چراغ نیاز داریم.',
  },
  'fallen-signal': {
    art: ['forest', 'watch', 'axle'],
    en: 'A little timber and I can get the light back up.',
    fa: 'با کمی چوب می‌توانم چراغ را دوباره بالا ببرم.',
  },
  'empty-casks': {
    art: ['forest', 'trade', 'cask'],
    en: 'Dry staves won’t bend. Can you spare water?',
    fa: 'تختهٔ خشک خم نمی‌شود. می‌توانید کمی آب بدهید؟',
  },
  woodbridge: {
    art: ['forest', 'river', 'trade'],
    en: 'I can bring the bread across if the planks hold.',
    fa: 'اگر تخته‌ها دوام بیاورند، نان را به این طرف می‌آورم.',
  },
  charcoal: {
    art: ['forest', 'watch', 'trade'],
    en: 'Grain for water. I can sell you less for coin.',
    fa: 'غله در برابر آب. با سکه می‌توانم مقدار کمتری بفروشم.',
  },
  sled: {
    art: ['mountains', 'sleet', 'axle'],
    en: 'It caught on the tree! Can you tie it off?',
    fa: 'به درخت گیر کرده! می‌توانید آن را ببندید؟',
  },
  winch: {
    art: ['mountains', 'axle', 'cask'],
    en: 'The bucket’s there. We just have to free the winch.',
    fa: 'سطل آنجاست. فقط باید چرخ چاه را آزاد کنیم.',
  },
  courier: {
    art: ['ash', 'watch', 'trade'],
    en: 'I can carry the parcels if I can walk.',
    fa: 'اگر بتوانم راه بروم، بسته‌ها را می‌رسانم.',
  },
  'covered-well': {
    art: ['ash', 'axle', 'cask'],
    en: 'Listen. There’s still water under that stone.',
    fa: 'گوش کنید. زیر آن سنگ هنوز آب هست.',
  },
  'lina-letter': {
    art: ['watch', 'letter', 'letter'],
    en: 'Would you carry these words as far as the city?',
    fa: 'می‌شود این کلمات را تا شهر ببرید؟',
  },
  'mara-map': {
    art: ['forest', 'letter', 'axle'],
    en: 'I remember the bend. I could mark it for the wagon.',
    fa: 'پیچ را به یاد دارم. می‌توانم برای گاری نشانه بگذارم.',
  },
  'bram-watch': {
    art: ['watch', 'letter', 'trade'],
    en: 'There was always a cup for the last one off watch.',
    fa: 'همیشه یک پیاله برای آخرین نفرِ نگهبانی می‌گذاشتیم.',
  },
  'iona-tea': {
    art: ['letter', 'vial', 'cask'],
    en: 'There’s enough for everyone if the water holds.',
    fa: 'اگر آب برسد، برای همه کافی است.',
  },
};
export const sceneFor = (id: string | undefined) =>
  id && Object.hasOwn(comicScenes, id) ? comicScenes[id] : undefined;
