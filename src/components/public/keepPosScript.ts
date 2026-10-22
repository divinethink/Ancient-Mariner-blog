export const KEEP_POS_KEY = "diaryCalPos";

/** পাতা লোডের শুরুতে চালানোর inline script (DiaryCalendar-এ বসে): মান থাকলে পাতা লুকায়, যাতে "ওপরে → নিচে" লাফ চোখে না পড়ে। ১.৫ সেকেন্ডে নিজে খুলে যায় (JS ব্যর্থ হলেও পাতা আটকে থাকে না); CalendarKeepPos জায়গা বসিয়ে খুলে দেয় */
export const KEEP_POS_HIDE = `try{var r=sessionStorage.getItem("${KEEP_POS_KEY}");if(r&&Date.now()-JSON.parse(r).t<8000){var d=document.documentElement;d.style.visibility="hidden";setTimeout(function(){d.style.visibility=""},1500)}}catch(e){}`;
