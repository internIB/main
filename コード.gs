// ============================================================
//  勤怠管理システム — Google Apps Script  v15.0  (ハイブリット対応)
//  【v15.0 変更点】
//  ① メンバー別Googleカレンダー対応
//     管理者シート B列: メールアドレス / C列: カレンダーID（省略可）
//     getCalendarIdForMember_() でメンバー毎のカレンダーを参照
//     Webアプリを "Execute as: User accessing the web app" で
//     デプロイすると CalendarApp が自動で本人のカレンダーを使用
//  ② 自動ユーザー検出 getCurrentUserInfoForWeb()
//     ログイン中Googleアカウントのメールと管理者シートのB列を照合
//     → Webフォームで名前を自動選択
//  ③ 全カレンダー操作をメンバー別カレンダーIDに変更
//     confirmToCalendar / execute / processFromWeb /
//     deleteShiftFromAdmin / applyChangeRow_ / revokeChangeRow_
//  【v14.3】個人シートに「閉じる」チェックボックス
//  【v14.2】勤怠管理と月管理を分離 / 個人シートデフォルト非表示
//  【v14.1】Web フォームを個人シート経由に / Web 管理者機能追加
//  【v14.0】個人シート化 / ハブシート / バグ修正 / LockService
// ============================================================

const CONFIG = {
  ADMIN_SHEET:            "管理者",
  INPUT_SHEET:            "入力",
  CHANGE_SHEET:           "変更",
  PERSONAL_INPUT_PREFIX:  "入力_",
  PERSONAL_CHANGE_PREFIX: "変更_",
  HUB_SHEET:              "勤怠管理",
  MONTH_HUB_SHEET:        "月管理",
  HUB_NAME_CELL:          "B3",
  HUB_INPUT_NAV_ROW:      3,
  HUB_INPUT_NAV_COL:      4,
  HUB_CHANGE_NAV_ROW:     4,
  HUB_CHANGE_NAV_COL:     4,
  MONTH_HUB_MONTH_CELL:   "B3",
  MONTH_HUB_NAV_ROW:      3,
  MONTH_HUB_NAV_COL:      4,
  CHANGE_HISTORY_SHEET:   "変更履歴",
  REFLECTION_SUFFIX:      "月反映",

  // v15.0: 管理者シートの列定義
  // A列: 名前 / B列: メールアドレス / C列: カレンダーID（省略可）
  MEMBER_NAME_COL:   1,  // A
  MEMBER_EMAIL_COL:  2,  // B（v15.0追加）
  MEMBER_CAL_COL:    3,  // C（v15.0追加）

  // v14.3: 個人シートの「閉じる」チェックボックス位置
  PERSONAL_INPUT_CLOSE_COL:  7,   // G列（入力シート）
  PERSONAL_INPUT_CLOSE_ROW:  2,
  PERSONAL_CHANGE_CLOSE_COL: 11,  // K列（変更シート）
  PERSONAL_CHANGE_CLOSE_ROW: 2,

  DEFAULT_COLOR_OFFICE:      "#FFA500",
  DEFAULT_COLOR_REMOTE:      "#FFFFFF",
  DEFAULT_COLOR_OFFICE_REQ:  "#FFE0B2",
  DEFAULT_COLOR_REMOTE_REQ:  "#E3F2FD",
  DEFAULT_COLOR_PC_OFFICE:   "#C8E6C9",

  // 管理者シートの既存セル（列シフトなし）
  CAL_ID_VALUE_CELL:      "E2",   // v15.0: D2→E2 (B,C列追加のため)
  COLOR_OFFICE_CELL:      "E13",
  COLOR_REMOTE_CELL:      "E14",
  COLOR_OFFICE_REQ_CELL:  "E15",
  COLOR_REMOTE_REQ_CELL:  "E16",
  COLOR_PC_OFFICE_CELL:   "E17",

  PASSWORD_CELL:    "G2",         // v15.0: F2→G2
  DELETE_DATE_CELL: "H3",         // v15.0: G3→H3
  DELETE_NAME_CELL: "I3",         // v15.0: H3→I3

  INPUT_MAX_ROWS:          5,
  CHANGE_MAX_ROWS:         5,
  CHANGE_HISTORY_MAX_ROWS: 500,
  APPROVED_BG:             "#E8F5E9",
};

const NOTE_CAL_SUFFIX = "|cal";

const HIST_COL = {
  DATETIME:0,NAME:1,OLD_DATE:2,OLD_TIME:3,NEW_DATE:4,NEW_TIME:5,
  WORK_TYPE:6,REASON:7,REASON_TEXT:8,CHECKBOX:9,REQ_TYPE:10,STATUS:11,
};


// ============================================================
//  1. メニュー
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu("勤怠管理")
    .addItem("▶ 入力実行","execute")
    .addItem("▶ 変更実行（履歴に記録）","executeChange")
    .addItem("✅ 変更承認（チェック済みを反映）","approveChanges")
    .addItem("▶ シフト削除（管理者）","deleteShiftFromAdmin")
    .addItem("決定：カレンダーに反映","confirmToCalendar")
    .addSeparator()
    .addItem("👤 自分の入力シートへ移動","navigateToMyInputSheet")
    .addItem("🔄 自分の変更シートへ移動","navigateToMyChangeSheet")
    .addItem("📅 月反映シートへ移動","navigateToMonthSheet")
    .addSeparator()
    .addItem("📋 変更履歴を表示","showChangeHistorySheets")
    .addItem("📋 変更履歴を非表示","hideChangeHistorySheets")
    .addSeparator()
    .addItem("🔑 管理者タブを表示","showAdminSheet")
    .addItem("🔑 管理者タブを非表示","hideAdminSheet")
    .addItem("🔑 パスワード変更","changeAdminPassword")
    .addSeparator()
    .addItem("⚙️ チェックボックス自動処理トリガー設定（初回のみ）","setupOnEditTrigger")
    .addSeparator()
    .addItem("初期設定：管理者タブ作成","setupAdminSheet")
    .addItem("初期設定：変更履歴タブ作成","setupChangeHistorySheet")
    .addItem("初期設定：勤怠管理タブ作成","setupHubSheet")
    .addItem("初期設定：月管理タブ作成","setupMonthHubSheet")
    .addItem("初期設定：個人シート作成（全員分）","setupAllPersonalSheets")
    .addItem("初期設定：反映タブ作成（全月）","setupAllReflectionSheets")
    .addSeparator()
    .addItem("メンバー変更を反映（追加＆削除）","syncMembers")
    .addItem("セル色を一括更新","applyColorsToAll")
    .addItem("カレンダー設定を確認","verifySettings")
    .addToUi();
}


// ============================================================
//  2. 日付ヘルパー（前月21日〜当月20日）
// ============================================================
function getDateRangeForSheet_(year,month){
  var py=year,pm=month-1;if(pm===0){pm=12;py=year-1;}
  var s=new Date(py,pm-1,21),e=new Date(year,month-1,20);
  return{startDate:s,endDate:e,totalDays:Math.round((e-s)/86400000)+1};
}
function getSheetInfoForDate_(date){
  var day=date.getDate(),m=date.getMonth()+1,y=date.getFullYear();
  if(day>=21){if(m===12)return{sheetMonth:1,sheetYear:y+1};return{sheetMonth:m+1,sheetYear:y};}
  return{sheetMonth:m,sheetYear:y};
}
function getDateColumn_(date,sy,sm){
  var r=getDateRangeForSheet_(sy,sm);
  return Math.round((date.getTime()-r.startDate.getTime())/86400000)+2;
}


// ============================================================
//  3. パスワード
// ============================================================
function getAdminPassword_(){
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
  if(!s)return"IB";var v=String(s.getRange(CONFIG.PASSWORD_CELL).getValue()).trim();return v||"IB";
}
function checkPassword_(){
  var ui=SpreadsheetApp.getUi();
  var r=ui.prompt("🔑 パスワード確認","管理者パスワードを入力してください:",ui.ButtonSet.OK_CANCEL);
  return r.getSelectedButton()===ui.Button.OK&&r.getResponseText().trim()===getAdminPassword_();
}
function changeAdminPassword(){
  var ui=SpreadsheetApp.getUi();
  if(!checkPassword_()){ui.alert("エラー","現在のパスワードが正しくありません。",ui.ButtonSet.OK);return;}
  var r=ui.prompt("🔑 パスワード変更","新しいパスワードを入力してください:",ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var pw=r.getResponseText().trim();if(!pw){ui.alert("エラー","パスワードを入力してください。",ui.ButtonSet.OK);return;}
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
  if(!s){ui.alert("エラー","管理者タブが見つかりません。",ui.ButtonSet.OK);return;}
  s.getRange(CONFIG.PASSWORD_CELL).setValue(pw);ui.alert("完了","パスワードを変更しました。",ui.ButtonSet.OK);
}
function showAdminSheet(){
  var ui=SpreadsheetApp.getUi(),ss=SpreadsheetApp.getActiveSpreadsheet();
  var s=ss.getSheetByName(CONFIG.ADMIN_SHEET);
  if(!s){ui.alert("エラー","管理者タブが見つかりません。",ui.ButtonSet.OK);return;}
  if(!checkPassword_())return;s.showSheet();ss.setActiveSheet(s);
  ui.alert("✅ 表示完了","管理者タブを表示しました。\n編集後は「🔑 管理者タブを非表示」で非表示にしてください。",ui.ButtonSet.OK);
}
function hideAdminSheet(){
  var ui=SpreadsheetApp.getUi();
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
  if(!s){ui.alert("エラー","管理者タブが見つかりません。",ui.ButtonSet.OK);return;}
  s.hideSheet();ui.alert("完了","管理者タブを非表示にしました。",ui.ButtonSet.OK);
}


// ============================================================
//  4. シフト削除（管理者）
// ============================================================
function deleteShiftFromAdmin(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  if(!checkPassword_()){ui.alert("エラー","パスワードが正しくありません。",ui.ButtonSet.OK);return;}
  var adminSheet=ss.getSheetByName(CONFIG.ADMIN_SHEET);
  if(!adminSheet){ui.alert("エラー","「管理者」タブが見つかりません。",ui.ButtonSet.OK);return;}
  var dateVal=adminSheet.getRange(CONFIG.DELETE_DATE_CELL).getValue();
  var name=String(adminSheet.getRange(CONFIG.DELETE_NAME_CELL).getValue()).trim();
  if(!dateVal||!name){ui.alert("入力不足","日付とメンバー名を管理者タブに入力してください。",ui.ButtonSet.OK);return;}
  var date=new Date(dateVal);if(isNaN(date.getTime())){ui.alert("エラー","日付が不正です。",ui.ButtonSet.OK);return;}
  if(ui.alert("削除確認","【"+formatDateStr_(date)+"】 "+name+" のシフトを削除します。\n実行しますか？",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var info=getSheetInfoForDate_(date);
  var refSheet=ss.getSheetByName(info.sheetMonth+CONFIG.REFLECTION_SUFFIX);
  if(!refSheet){ui.alert("エラー",info.sheetMonth+"月反映タブが見つかりません。",ui.ButtonSet.OK);return;}
  var memberRow=findMemberRow_(refSheet,name);if(memberRow===-1){ui.alert("エラー",name+" が登録されていません。",ui.ButtonSet.OK);return;}
  var cell=refSheet.getRange(memberRow,getDateColumn_(date,info.sheetYear,info.sheetMonth));
  if(!String(cell.getValue()).trim()){ui.alert("情報","シフトデータが見つかりません。",ui.ButtonSet.OK);return;}
  // ★v15.0: メンバー別カレンダーIDを使用
  deleteCalendarEvent_(getCalendarIdForMember_(name),date,name);
  cell.clearContent().setBackground(null).setFontLine("none").setNote("");
  adminSheet.getRange(CONFIG.DELETE_DATE_CELL).clearContent();adminSheet.getRange(CONFIG.DELETE_NAME_CELL).clearContent();
  ui.alert("削除完了","【"+formatDateStr_(date)+"】 "+name+" のシフトを削除しました。",ui.ButtonSet.OK);
}


// ============================================================
//  5. Webアプリ
// ============================================================
function doGet(){
  return HtmlService.createTemplateFromFile("フォーム")
    .evaluate().setTitle("勤怠管理").addMetaTag("viewport","width=device-width, initial-scale=1, viewport-fit=cover");
}
function getMembersForWeb(){return getMembers_();}
function getColorsForWeb(){return getColors_();}

// ★v15.0: 現在ログイン中のGoogleユーザー情報を返す
// Webアプリを "Execute as: User accessing the web app" でデプロイすると有効
function getCurrentUserInfoForWeb(){
  var email="";
  try{email=Session.getActiveUser().getEmail();}catch(e){}
  var matchedName=null;
  if(email){
    var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
    if(s&&s.getLastRow()>=2){
      var vals=s.getRange(2,1,s.getLastRow()-1,2).getValues();
      for(var i=0;i<vals.length;i++){
        if(String(vals[i][CONFIG.MEMBER_EMAIL_COL-1]).trim().toLowerCase()===email.toLowerCase()){
          matchedName=String(vals[i][0]).trim();break;
        }
      }
    }
  }
  return{email:email,matchedName:matchedName};
}


// ============================================================
//  5-A. Webフォーム（入力）★v15.0: メンバー別カレンダーID対応
// ============================================================
function processFromWeb(formData){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var entries=formData.entries,name=formData.name,action=formData.action;
  if(!entries||entries.length===0)return{success:false,message:"日付を1つ以上入力してください。"};
  if(!name||!action)return{success:false,message:"名前・操作は必須です。"};

  if(!ss.getSheetByName(CONFIG.PERSONAL_INPUT_PREFIX+name)){
    return{success:false,message:name+" の個人入力シートが見つかりません。\n管理者に「初期設定：個人シート作成（全員分）」の実行を依頼してください。"};
  }

  var lock=LockService.getScriptLock();
  try{lock.waitLock(20000);}catch(e){return{success:false,message:"処理中です。しばらく待ってから再送信してください。"};}
  try{
    var colors=getColors_(),successCount=0,errorMessages=[];
    // ★v15.0: メンバー別カレンダーIDを取得
    var calendarId=getCalendarIdForMember_(name);

    for(var i=0;i<entries.length&&i<CONFIG.INPUT_MAX_ROWS;i++){
      var en=entries[i];
      if(!en.date)continue;
      var date=new Date(en.date+"T00:00:00");
      if(isNaN(date.getTime())){errorMessages.push((i+1)+"件目: 日付不正");continue;}
      var workType=en.workType||"";
      if(!workType&&action==="作成"){errorMessages.push((i+1)+"件目: 種別未選択");continue;}
      var info=getSheetInfoForDate_(date);
      var refSheet=ss.getSheetByName(info.sheetMonth+CONFIG.REFLECTION_SUFFIX);
      if(!refSheet){errorMessages.push(formatDateStr_(date)+": 反映タブなし");continue;}
      var memberRow=findMemberRow_(refSheet,name);
      if(memberRow===-1){errorMessages.push(formatDateStr_(date)+": "+name+"未登録");continue;}
      var dateCol=getDateColumn_(date,info.sheetYear,info.sheetMonth);

      if(action==="作成"){
        var st=en.startTime||"",et=en.endTime||"";
        if(!st||!et){errorMessages.push((i+1)+"件目: 時間未入力");continue;}
        var timeStr=st+" - "+et;
        var cell=refSheet.getRange(memberRow,dateCol);
        var bg=workType==="出社申請"?colors.officeReq:workType==="PC持参出社申請"?colors.pcOffice:colors.remoteReq;
        cell.setValue(timeStr).setBackground(bg).setFontColor("#000000").setFontLine("none").setNote(workType);
        successCount++;
      }else if(action==="削除"){
        var cell=refSheet.getRange(memberRow,dateCol);
        if(String(cell.getNote()).indexOf(NOTE_CAL_SUFFIX)!==-1)deleteCalendarEvent_(calendarId,date,name);
        cell.clearContent().setBackground(null).setFontLine("none").setNote("");
        successCount++;
      }
    }

    if(successCount===0&&errorMessages.length>0)return{success:false,message:"エラー:\n"+errorMessages.join("\n")};
    var msg=action==="作成"?"✅ "+successCount+" 日分を申請しました（"+name+"）":"🗑️ "+successCount+" 日分を削除しました（"+name+"）";
    msg+="\n※ カレンダーへの反映は管理者の「決定」で行われます";
    if(errorMessages.length>0)msg+="\n\n⚠️ エラー:\n"+errorMessages.join("\n");
    return{success:true,message:msg};
  }finally{lock.releaseLock();}
}


// ============================================================
//  5-B. Webフォーム（変更）
// ============================================================
function processChangeFromWeb(formData){
  var ss=SpreadsheetApp.getActiveSpreadsheet();
  var entries=formData.entries,name=formData.name;
  if(!entries||entries.length===0)return{success:false,message:"変更内容を1つ以上入力してください。"};
  if(!name)return{success:false,message:"名前は必須です。"};

  if(!ss.getSheetByName(CONFIG.PERSONAL_CHANGE_PREFIX+name)){
    return{success:false,message:name+" の個人変更シートが見つかりません。\n管理者に「初期設定：個人シート作成（全員分）」の実行を依頼してください。"};
  }

  var lock=LockService.getScriptLock();
  try{lock.waitLock(20000);}catch(e){return{success:false,message:"処理中です。しばらく待ってから再送信してください。"};}
  try{
    var successCount=0,errorMessages=[];

    for(var i=0;i<entries.length&&i<CONFIG.CHANGE_MAX_ROWS;i++){
      var en=entries[i];
      var hasOld=!!en.oldDate,hasNew=!!en.newDate;
      if(!hasOld&&!hasNew)continue;
      var reqType=!hasOld&&hasNew?"追加申請":hasOld&&!hasNew?"削除申請":"変更";
      var oldDate=hasOld?new Date(en.oldDate+"T00:00:00"):null;
      var newDate=hasNew?new Date(en.newDate+"T00:00:00"):null;
      if(oldDate&&isNaN(oldDate.getTime())){errorMessages.push((i+1)+"件目: 変更前日付不正");continue;}
      if(newDate&&isNaN(newDate.getTime())){errorMessages.push((i+1)+"件目: 変更後日付不正");continue;}
      var ots=(en.oldStart&&en.oldEnd)?en.oldStart+" - "+en.oldEnd:"";
      var nts=(en.newStart&&en.newEnd)?en.newStart+" - "+en.newEnd:"";
      try{
        var hs=getCurrentHistorySheet_();
        var nowStr=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy/MM/dd HH:mm:ss");
        var nr=hs.getLastRow()+1;
        hs.getRange(nr,1,1,12).setValues([[
          nowStr,name,
          oldDate?formatDateStr_(oldDate):"",ots||"",
          newDate?formatDateStr_(newDate):"",nts||"",
          en.workType||"",en.changeReason||"",en.reasonText||"",
          false,reqType||"変更","申請中"
        ]]);
        hs.getRange(nr,10).insertCheckboxes();successCount++;
      }catch(e){errorMessages.push((i+1)+"件目: "+e.message);}
    }

    SpreadsheetApp.flush();
    if(successCount===0&&errorMessages.length>0)return{success:false,message:"エラー:\n"+errorMessages.join("\n")};
    var msg="✅ "+successCount+" 件を申請しました（"+name+"）\n管理者の承認後に反映されます。";
    if(errorMessages.length>0)msg+="\n\n⚠️ エラー:\n"+errorMessages.join("\n");
    return{success:true,message:msg};
  }finally{lock.releaseLock();}
}


// ============================================================
//  5-C. 承認待ちの変更申請をWeb管理者画面向けに返す
// ============================================================
function getPendingChangesForWeb(password){
  if(String(password).trim()!==getAdminPassword_())return{success:false,message:"パスワードが正しくありません。"};
  var ss=SpreadsheetApp.getActiveSpreadsheet(),histSheets=getAllHistorySheets_(ss),pending=[];
  for(var s=0;s<histSheets.length;s++){
    var hs=histSheets[s],lr=hs.getLastRow();if(lr<2)continue;
    var vals=hs.getRange(2,1,lr-1,12).getValues();
    for(var i=0;i<vals.length;i++){
      if(String(vals[i][HIST_COL.STATUS]).trim()==="承認済")continue;
      pending.push({sheetName:hs.getName(),rowNum:i+2,
        datetime:String(vals[i][HIST_COL.DATETIME]),name:String(vals[i][HIST_COL.NAME]),
        oldDate:String(vals[i][HIST_COL.OLD_DATE]),oldTime:String(vals[i][HIST_COL.OLD_TIME]),
        newDate:String(vals[i][HIST_COL.NEW_DATE]),newTime:String(vals[i][HIST_COL.NEW_TIME]),
        workType:String(vals[i][HIST_COL.WORK_TYPE]),reason:String(vals[i][HIST_COL.REASON]),
        reasonText:String(vals[i][HIST_COL.REASON_TEXT]),reqType:String(vals[i][HIST_COL.REQ_TYPE])||"変更"});
    }
  }
  return{success:true,data:pending};
}


// ============================================================
//  5-D. 指定行を承認する（Web管理者から）
// ============================================================
function approveChangeFromWeb(sheetName,rowNum,password){
  if(String(password).trim()!==getAdminPassword_())return{success:false,message:"パスワードが正しくありません。"};
  var ss=SpreadsheetApp.getActiveSpreadsheet(),hs=ss.getSheetByName(sheetName);
  if(!hs)return{success:false,message:"シートが見つかりません: "+sheetName};
  if(String(hs.getRange(rowNum,HIST_COL.STATUS+1).getValue()).trim()==="承認済")return{success:false,message:"この申請はすでに承認済みです。"};
  try{applyChangeRow_(ss,hs,rowNum,getColors_());return{success:true,message:"承認しました。"};}
  catch(e){return{success:false,message:"承認処理中にエラーが発生しました: "+e.message};}
}


// ============================================================
//  6. メンバー／カレンダーID／色
// ============================================================
function getMembers_(){
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);if(!s)return[];
  var lr=s.getLastRow();if(lr<2)return[];
  return s.getRange(2,1,lr-1,1).getValues().map(function(r){return String(r[0]).trim();}).filter(function(n){return n!=="";});
}

// グローバル（フォールバック）カレンダーID
function getCalendarId_(){
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);if(!s)return"primary";
  var v=String(s.getRange(CONFIG.CAL_ID_VALUE_CELL).getValue()).trim();return v||"primary";
}

// ★v15.0: メンバー別カレンダーIDを取得
// 優先順位: C列（カスタムカレンダーID） > B列（メールアドレス=プライマリカレンダー） > グローバル設定
function getCalendarIdForMember_(name){
  if(!name)return getCalendarId_();
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
  if(!s)return getCalendarId_();
  var lr=s.getLastRow();if(lr<2)return getCalendarId_();
  var vals=s.getRange(2,1,lr-1,3).getValues();
  for(var i=0;i<vals.length;i++){
    if(String(vals[i][0]).trim()===String(name).trim()){
      var customCal=String(vals[i][CONFIG.MEMBER_CAL_COL-1]).trim();
      if(customCal)return customCal;
      var email=String(vals[i][CONFIG.MEMBER_EMAIL_COL-1]).trim();
      if(email)return email;
      break;
    }
  }
  return getCalendarId_();
}

function getColors_(){
  var s=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ADMIN_SHEET);
  var res={office:CONFIG.DEFAULT_COLOR_OFFICE,remote:CONFIG.DEFAULT_COLOR_REMOTE,
    officeReq:CONFIG.DEFAULT_COLOR_OFFICE_REQ,remoteReq:CONFIG.DEFAULT_COLOR_REMOTE_REQ,pcOffice:CONFIG.DEFAULT_COLOR_PC_OFFICE};
  if(s){try{var mp={office:CONFIG.COLOR_OFFICE_CELL,remote:CONFIG.COLOR_REMOTE_CELL,
    officeReq:CONFIG.COLOR_OFFICE_REQ_CELL,remoteReq:CONFIG.COLOR_REMOTE_REQ_CELL,pcOffice:CONFIG.COLOR_PC_OFFICE_CELL};
    for(var k in mp){var bg=s.getRange(mp[k]).getBackground();if(bg)res[k]=bg.toUpperCase();}}catch(e){}}
  return res;
}


// ============================================================
//  7. 入力実行（個人シート専用）★v15.0: メンバー別カレンダーID
// ============================================================
function execute(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var sh=ss.getActiveSheet(),sn=sh.getName();
  if(sn.indexOf(CONFIG.PERSONAL_INPUT_PREFIX)!==0){
    ui.alert("エラー","自分の入力シート（例: 入力_山田太郎）を開いた状態で実行してください。\n「勤怠管理」タブから移動してください。",ui.ButtonSet.OK);return;
  }
  var name=sh.getRange("E2").getValue(),action=sh.getRange("F2").getValue();
  if(!name||!action){ui.alert("入力不足","名前・操作は必須です。",ui.ButtonSet.OK);return;}
  // ★v15.0: メンバー別カレンダーID
  var calId=getCalendarIdForMember_(name),colors=getColors_(),suc=0,err=[];
  for(var r=2;r<=2+CONFIG.INPUT_MAX_ROWS-1;r++){
    var dv=sh.getRange(r,1).getValue();if(!dv)continue;
    var st=sh.getRange(r,2).getValue(),et=sh.getRange(r,3).getValue(),wt=sh.getRange(r,4).getValue();
    var date=new Date(dv);if(isNaN(date.getTime())){err.push("行"+r+": 日付不正");continue;}
    if(!wt){err.push("行"+r+": 種別未選択");continue;}
    var info=getSheetInfoForDate_(date);
    var ref=ss.getSheetByName(info.sheetMonth+CONFIG.REFLECTION_SUFFIX);
    if(!ref){err.push("行"+r+": 反映タブなし");continue;}
    var mr=findMemberRow_(ref,name);if(mr===-1){err.push("行"+r+": "+name+"未登録");continue;}
    var dc=getDateColumn_(date,info.sheetYear,info.sheetMonth);
    if(action==="作成"){
      if(!st||!et){err.push("行"+r+": 時間未入力");continue;}
      var ts=formatTime_(st)+" - "+formatTime_(et);
      var cell=ref.getRange(mr,dc);
      var bg=wt==="出社申請"?colors.officeReq:wt==="PC持参出社申請"?colors.pcOffice:colors.remoteReq;
      cell.setValue(ts).setBackground(bg).setFontColor("#000000").setFontLine("none").setNote(wt);suc++;
    }else if(action==="削除"){
      var cell=ref.getRange(mr,dc);
      if(String(cell.getNote()).indexOf(NOTE_CAL_SUFFIX)!==-1)deleteCalendarEvent_(calId,date,name);
      cell.clearContent().setBackground(null).setFontLine("none").setNote("");suc++;
    }
  }
  if(suc===0&&err.length>0){ui.alert("エラー",err.join("\n"),ui.ButtonSet.OK);return;}
  var msg=action==="作成"?"✅ "+suc+" 日分を申請（"+name+"）":"🗑️ "+suc+" 日分を削除（"+name+"）";
  msg+="\n※ カレンダーへの反映は「決定」で行ってください";
  if(err.length>0)msg+="\n\n⚠️ エラー:\n"+err.join("\n");
  ui.alert("完了",msg,ui.ButtonSet.OK);
}


// ============================================================
//  8. 決定：カレンダーに反映 ★v15.0: メンバー毎にカレンダーIDを切替
// ============================================================
function confirmToCalendar(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  if(!checkPassword_()){ui.alert("エラー","パスワードが正しくありません。",ui.ButtonSet.OK);return;}
  var sh=ss.getActiveSheet(),sn=sh.getName();
  if(sn.indexOf(CONFIG.REFLECTION_SUFFIX)===-1){ui.alert("エラー","「〇月反映」タブを開いた状態で実行してください。",ui.ButtonSet.OK);return;}
  var month=parseInt(sn.replace(CONFIG.REFLECTION_SUFFIX,""),10);
  if(isNaN(month)||month<1||month>12){ui.alert("エラー","タブ名から月を判定できません。",ui.ButtonSet.OK);return;}
  var ym=String(sh.getRange(1,1).getValue()).match(/(\d{4})/);
  if(!ym){ui.alert("エラー","ヘッダーから年を読み取れません。",ui.ButtonSet.OK);return;}
  var year=parseInt(ym[1],10);
  if(ui.alert("決定","「"+sn+"」をGoogleカレンダーに反映します。\n各メンバーのカレンダーIDに従って登録されます。\n実行しますか？",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var colors=getColors_(),dr=getDateRangeForSheet_(year,month),td=dr.totalDays;
  var lr=sh.getLastRow();if(lr<3){ui.alert("情報","メンバーが登録されていません。",ui.ButtonSet.OK);return;}
  var mc=lr-2,mnames=sh.getRange(3,1,mc,1).getValues();
  var dataR=sh.getRange(3,2,mc,td);
  var vals=dataR.getValues(),notes=dataR.getNotes(),bgs=dataR.getBackgrounds();
  var ou=colors.office.toUpperCase(),ru=colors.remote.toUpperCase(),pu=colors.pcOffice.toUpperCase();
  var cc=0,sc=0,errs=[],nw=notes.map(function(r){return r.slice();}),hnc=false;
  for(var row=0;row<mc;row++){
    var n=String(mnames[row][0]).trim();if(!n)continue;
    // ★v15.0: メンバー毎にカレンダーIDを取得
    var memberCalId=getCalendarIdForMember_(n);
    for(var col=0;col<td;col++){
      var cv=String(vals[row][col]).trim();if(!cv)continue;
      var bg=bgs[row][col].toUpperCase(),note=String(notes[row][col]).trim();
      var ics=note.indexOf(NOTE_CAL_SUFFIX)!==-1,bn=note.replace(NOTE_CAL_SUFFIX,"");
      var date=new Date(dr.startDate);date.setDate(date.getDate()+col);
      var tt=bg===ou?"出社":bg===ru?"リモート":bg===pu?"PC持参出社":null;
      if(tt){
        if(ics&&bn===tt){sc++;continue;}
        try{
          deleteCalendarEvent_(memberCalId,date,n);
          var m=cv.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
          if(m){var sp=m[1].split(":"),ep=m[2].split(":");
            var es=new Date(date);es.setHours(+sp[0],+sp[1],0,0);
            var ee=new Date(date);ee.setHours(+ep[0],+ep[1],0,0);
            createCalendarEvent_(memberCalId,date,n,tt,es,ee);
          }else createCalendarEvent_(memberCalId,date,n,tt,null,null);
          nw[row][col]=tt+NOTE_CAL_SUFFIX;hnc=true;cc++;
        }catch(e){errs.push(formatDateStr_(date)+" "+n+": 作成エラー ("+e.message+")");}
      }else sc++;
    }
  }
  if(hnc)dataR.setNotes(nw);
  ui.alert("決定完了","🔵 カレンダー作成: "+cc+" 件\n⏭️ スキップ: "+sc+" 件"+(errs.length>0?"\n\n⚠️ エラー:\n"+errs.join("\n"):""),ui.ButtonSet.OK);
}


// ============================================================
//  9. 変更実行（個人シート専用）
// ============================================================
function executeChange(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var sh=ss.getActiveSheet(),sn=sh.getName();
  if(sn.indexOf(CONFIG.PERSONAL_CHANGE_PREFIX)!==0){
    ui.alert("エラー","自分の変更シート（例: 変更_山田太郎）を開いた状態で実行してください。\n「勤怠管理」タブから移動してください。",ui.ButtonSet.OK);return;
  }
  var name=sh.getRange("J2").getValue();
  if(!name){ui.alert("入力不足","名前は必須です（J2セル）。",ui.ButtonSet.OK);return;}
  var suc=0,errs=[];
  for(var r=2;r<=2+CONFIG.CHANGE_MAX_ROWS-1;r++){
    var oD=sh.getRange(r,1).getValue(),oS=sh.getRange(r,2).getValue(),oE=sh.getRange(r,3).getValue();
    var nD=sh.getRange(r,4).getValue(),nS=sh.getRange(r,5).getValue(),nE=sh.getRange(r,6).getValue();
    var wt=String(sh.getRange(r,7).getValue()).trim(),cr=String(sh.getRange(r,8).getValue()).trim(),rt=String(sh.getRange(r,9).getValue()).trim();
    var ho=!!oD,hn=!!nD;if(!ho&&!hn)continue;
    var reqType=!ho&&hn?"追加申請":ho&&!hn?"削除申請":"変更";
    var oldDate=ho?new Date(oD):null,newDate=hn?new Date(nD):null;
    if(oldDate&&isNaN(oldDate.getTime())){errs.push("行"+r+": 変更前日付不正");continue;}
    if(newDate&&isNaN(newDate.getTime())){errs.push("行"+r+": 変更後日付不正");continue;}
    var ots=(oS&&oE)?formatTime_(oS)+" - "+formatTime_(oE):"";
    var nts=(nS&&nE)?formatTime_(nS)+" - "+formatTime_(nE):"";
    try{recordChangeHistory_(ss,oldDate,ots,newDate,nts,name,wt,cr,rt,reqType);suc++;}
    catch(e){errs.push("行"+r+": "+e.message);}
  }
  if(suc===0&&errs.length>0){ui.alert("エラー",errs.join("\n"),ui.ButtonSet.OK);return;}
  var msg="✅ "+suc+" 件を変更履歴に記録しました（"+name+"）\n\n管理者が「変更履歴」タブでチェックを入れて「✅ 変更承認」メニューを実行すると反映されます。";
  if(errs.length>0)msg+="\n\n⚠️ エラー:\n"+errs.join("\n");
  ui.alert("記録完了",msg,ui.ButtonSet.OK);
}


// ============================================================
//  10. ヘルパー
// ============================================================
function findMemberRow_(sheet,name){
  var lr=sheet.getLastRow();if(lr<3)return -1;
  var vals=sheet.getRange(3,1,lr-2,1).getValues();
  for(var i=0;i<vals.length;i++){if(String(vals[i][0]).trim()===String(name).trim())return i+3;}
  return -1;
}
function formatTime_(v){
  if(v instanceof Date)return String(v.getHours()).padStart(2,"0")+":"+String(v.getMinutes()).padStart(2,"0");
  return String(v);
}
function formatDateStr_(date){if(!date)return"";return date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate();}
function parseDate_(s){
  if(!s)return null;s=String(s).trim();
  var m=s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if(m){var d=new Date(parseInt(m[1]),parseInt(m[2])-1,parseInt(m[3]));return isNaN(d.getTime())?null:d;}
  var d=new Date(s);return isNaN(d.getTime())?null:d;
}
function getTypeFromNote_(note){
  if(!note)return null;var n=String(note).replace(NOTE_CAL_SUFFIX,"").trim();
  var types=["出社","リモート","PC持参出社","出社申請","リモート申請","PC持参出社申請"];
  for(var i=0;i<types.length;i++){if(n===types[i])return types[i];}return null;
}
function guessTypeFromColor_(bg,colors){
  if(!bg)return"出社";var b=bg.toUpperCase();
  if(b===colors.remote.toUpperCase())return"リモート";
  if(b===colors.officeReq.toUpperCase())return"出社申請";
  if(b===colors.remoteReq.toUpperCase())return"リモート申請";
  if(b===colors.pcOffice.toUpperCase())return"PC持参出社";
  return"出社";
}


// ============================================================
//  11〜12. 変更履歴シート管理
// ============================================================
function getCurrentHistorySheet_(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),base=CONFIG.CHANGE_HISTORY_SHEET,idx=1;
  while(true){
    var sn=idx===1?base:base+idx,sh=ss.getSheetByName(sn);
    if(!sh)return createHistorySheetInternal_(sn);
    if(sh.getLastRow()-1<CONFIG.CHANGE_HISTORY_MAX_ROWS)return sh;
    idx++;
  }
}
function createHistorySheetInternal_(sn){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sh=ss.insertSheet(sn);
  var h=["変更日時","名前","変更前日付","変更前時間","変更後日付","変更後時間","種別","変更理由","理由詳細","承認","申請種別","処理状態"];
  sh.getRange(1,1,1,h.length).setValues([h]).setFontWeight("bold").setBackground("#4A86C8").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  [170,100,110,120,110,120,90,80,200,60,90,80].forEach(function(w,i){sh.setColumnWidth(i+1,w);});
  sh.setFrozenRows(1);sh.hideSheet();return sh;
}
function isHistorySheet_(sn){
  return sn===CONFIG.CHANGE_HISTORY_SHEET||new RegExp("^"+CONFIG.CHANGE_HISTORY_SHEET+"\\d+$").test(sn);
}
function getAllHistorySheets_(ss){
  if(!ss)ss=SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheets().filter(function(s){return isHistorySheet_(s.getName());});
}

function recordChangeHistory_(ss,oldDate,oldTs,newDate,newTs,name,wt,cr,rt,reqType){
  var lock=LockService.getScriptLock();
  try{lock.waitLock(30000);}catch(e){throw new Error("他のユーザーが処理中です。しばらく待ってから再度お試しください。");}
  try{
    var hs=getCurrentHistorySheet_();
    var nowStr=Utilities.formatDate(new Date(),Session.getScriptTimeZone(),"yyyy/MM/dd HH:mm:ss");
    var nr=hs.getLastRow()+1;
    hs.getRange(nr,1,1,12).setValues([[nowStr,name,oldDate?formatDateStr_(oldDate):"",oldTs||"",newDate?formatDateStr_(newDate):"",newTs||"",wt||"",cr||"",rt||"",false,reqType||"変更","申請中"]]);
    hs.getRange(nr,10).insertCheckboxes();SpreadsheetApp.flush();
  }finally{lock.releaseLock();}
}


// ============================================================
//  13. 変更承認
// ============================================================
function approveChanges(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  if(!checkPassword_()){ui.alert("エラー","パスワードが正しくありません。",ui.ButtonSet.OK);return;}
  var hss=getAllHistorySheets_(ss);if(hss.length===0){ui.alert("エラー","「変更履歴」タブが存在しません。",ui.ButtonSet.OK);return;}
  var ac=0,errs=[];
  for(var s=0;s<hss.length;s++){
    var hs=hss[s],lr=hs.getLastRow();if(lr<2)continue;
    var nr=lr-1,vals=hs.getRange(2,1,nr,12).getValues();
    var cbDisp=hs.getRange(2,HIST_COL.CHECKBOX+1,nr,1).getDisplayValues();
    for(var i=0;i<vals.length;i++){
      if(cbDisp[i][0]==="TRUE"&&String(vals[i][HIST_COL.STATUS]).trim()!=="承認済"){
        try{applyChangeRow_(ss,hs,i+2,getColors_());ac++;}
        catch(e){errs.push((i+2)+"行目: "+e.message);}
      }
    }
  }
  var msg="✅ "+ac+" 件を承認・反映しました。";
  if(ac===0&&errs.length===0)msg+="\n\n（チェックが入っていないか、すでに承認済みです）";
  if(errs.length>0)msg+="\n\n⚠️ エラー:\n"+errs.join("\n");
  ui.alert("承認完了",msg,ui.ButtonSet.OK);
}


// ============================================================
//  14. 変更行の反映・取消 ★v15.0: calIdパラメータ廃止→nameから取得
// ============================================================
function applyChangeRow_(ss,hs,rowNum,colors){
  var d=hs.getRange(rowNum,1,1,12).getValues()[0];
  var name=String(d[HIST_COL.NAME]).trim(),wt=String(d[HIST_COL.WORK_TYPE]).trim(),rt=String(d[HIST_COL.REQ_TYPE]).trim();
  var oldDate=parseDate_(String(d[HIST_COL.OLD_DATE])),newDate=parseDate_(String(d[HIST_COL.NEW_DATE]));
  var ots=String(d[HIST_COL.OLD_TIME]).trim(),nts=String(d[HIST_COL.NEW_TIME]).trim();
  // ★v15.0: メンバー別カレンダーID
  var calId=getCalendarIdForMember_(name);
  if(rt==="追加申請"){if(!newDate)throw new Error("追加申請の変更後日付が不正");applyNewShift_(ss,newDate,nts,wt,name,calId,colors);}
  else if(rt==="削除申請"){if(!oldDate)throw new Error("削除申請の変更前日付が不正");removeOldShift_(ss,oldDate,name,calId,wt,ots,colors);}
  else{if(oldDate)removeOldShift_(ss,oldDate,name,calId,wt,ots,colors);if(newDate)applyNewShift_(ss,newDate,nts,wt,name,calId,colors);}
  hs.getRange(rowNum,HIST_COL.STATUS+1).setValue("承認済");hs.getRange(rowNum,1,1,12).setBackground(CONFIG.APPROVED_BG);
}
function revokeChangeRow_(ss,hs,rowNum,colors){
  var d=hs.getRange(rowNum,1,1,12).getValues()[0];
  var name=String(d[HIST_COL.NAME]).trim(),wt=String(d[HIST_COL.WORK_TYPE]).trim(),rt=String(d[HIST_COL.REQ_TYPE]).trim();
  var oldDate=parseDate_(String(d[HIST_COL.OLD_DATE])),newDate=parseDate_(String(d[HIST_COL.NEW_DATE]));
  var ots=String(d[HIST_COL.OLD_TIME]).trim(),nts=String(d[HIST_COL.NEW_TIME]).trim();
  // ★v15.0: メンバー別カレンダーID
  var calId=getCalendarIdForMember_(name);
  if(rt==="追加申請"){if(newDate)removeOldShift_(ss,newDate,name,calId,wt,nts,colors);}
  else if(rt==="削除申請"){if(oldDate)applyNewShift_(ss,oldDate,ots,wt,name,calId,colors);}
  else{if(newDate)removeOldShift_(ss,newDate,name,calId,wt,nts,colors);if(oldDate)applyNewShift_(ss,oldDate,ots,wt,name,calId,colors);}
  hs.getRange(rowNum,HIST_COL.STATUS+1).setValue("申請中");hs.getRange(rowNum,1,1,12).setBackground(null);
}
function applyNewShift_(ss,date,timeStr,wt,name,calId,colors){
  if(!date||!name)return;
  var info=getSheetInfoForDate_(date),ref=ss.getSheetByName(info.sheetMonth+CONFIG.REFLECTION_SUFFIX);
  if(!ref)throw new Error(info.sheetMonth+"月反映タブが見つかりません");
  var mr=findMemberRow_(ref,name);if(mr===-1)throw new Error(name+" が登録されていません");
  var cell=ref.getRange(mr,getDateColumn_(date,info.sheetYear,info.sheetMonth));
  var bg,nt=wt||"出社";
  if(!wt||wt==="出社"){bg=colors.office;nt="出社";}
  else if(wt==="リモート"){bg=colors.remote;nt="リモート";}
  else if(wt==="PC持参出社"){bg=colors.pcOffice;nt="PC持参出社";}
  else if(wt==="出社申請"){bg=colors.officeReq;nt="出社申請";}
  else if(wt==="リモート申請"){bg=colors.remoteReq;nt="リモート申請";}
  else if(wt==="PC持参出社申請"){bg=colors.pcOffice;nt="PC持参出社申請";}
  else{bg=colors.office;nt=wt;}
  var disp=timeStr||"",calNote=nt;
  if(["出社","リモート","PC持参出社"].indexOf(nt)!==-1){
    deleteCalendarEvent_(calId,date,name);
    if(disp){var m=disp.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
      if(m){var sp=m[1].split(":"),ep=m[2].split(":");
        var es=new Date(date);es.setHours(+sp[0],+sp[1],0,0);
        var ee=new Date(date);ee.setHours(+ep[0],+ep[1],0,0);
        createCalendarEvent_(calId,date,name,nt,es,ee);
      }else createCalendarEvent_(calId,date,name,nt,null,null);
    }else createCalendarEvent_(calId,date,name,nt,null,null);
    calNote=nt+NOTE_CAL_SUFFIX;
  }
  cell.setValue(disp||nt).setBackground(bg).setFontColor("#000000").setFontLine("none").setNote(calNote);
}
function removeOldShift_(ss,date,name,calId,wt,timeStr,colors){
  if(!date||!name)return;
  var info=getSheetInfoForDate_(date),ref=ss.getSheetByName(info.sheetMonth+CONFIG.REFLECTION_SUFFIX);
  if(!ref)return;
  var mr=findMemberRow_(ref,name);if(mr===-1)return;
  var cell=ref.getRange(mr,getDateColumn_(date,info.sheetYear,info.sheetMonth));
  if(String(cell.getNote()).indexOf(NOTE_CAL_SUFFIX)!==-1)deleteCalendarEvent_(calId,date,name);
  cell.clearContent().setBackground(null).setFontLine("none").setNote("");
}


// ============================================================
//  15. onEditInstallable
// ============================================================
function setupOnEditTrigger(){
  var ui=SpreadsheetApp.getUi();
  if(!checkPassword_()){ui.alert("エラー","パスワードが正しくありません。",ui.ButtonSet.OK);return;}
  var triggers=ScriptApp.getProjectTriggers();
  for(var i=0;i<triggers.length;i++){if(triggers[i].getHandlerFunction()==="onEditInstallable")ScriptApp.deleteTrigger(triggers[i]);}
  ScriptApp.newTrigger("onEditInstallable").forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  ui.alert("✅ 完了",
    "チェックボックス自動処理トリガーを設定しました。\n\n" +
    "・個人シート G2（入力）/ K2（変更）のチェックでシートを非表示\n" +
    "・「勤怠管理」D3/D4 チェックで個人シートへナビゲート\n" +
    "・「月管理」D3 チェックで月反映シートへナビゲート\n" +
    "・変更履歴 J列チェックで自動反映・取消",
    ui.ButtonSet.OK);
}

function onEditInstallable(e){
  if(!e||!e.range)return;
  var sheet=e.range.getSheet(),sn=sheet.getName(),col=e.range.getColumn(),row=e.range.getRow();
  var ss=SpreadsheetApp.getActiveSpreadsheet();

  if(sn===CONFIG.HUB_SHEET){
    if(e.range.getValue()!==true)return;
    if(row===CONFIG.HUB_INPUT_NAV_ROW&&col===CONFIG.HUB_INPUT_NAV_COL){
      e.range.setValue(false);navigateToMyInputSheet_fromHub_(sheet);
    }else if(row===CONFIG.HUB_CHANGE_NAV_ROW&&col===CONFIG.HUB_CHANGE_NAV_COL){
      e.range.setValue(false);navigateToMyChangeSheet_fromHub_(sheet);
    }
    return;
  }

  if(sn===CONFIG.MONTH_HUB_SHEET){
    if(e.range.getValue()!==true)return;
    if(row===CONFIG.MONTH_HUB_NAV_ROW&&col===CONFIG.MONTH_HUB_NAV_COL){
      e.range.setValue(false);navigateToMonthSheet_fromHub_(sheet);
    }
    return;
  }

  if(sn.indexOf(CONFIG.PERSONAL_INPUT_PREFIX)===0){
    if(row===CONFIG.PERSONAL_INPUT_CLOSE_ROW&&col===CONFIG.PERSONAL_INPUT_CLOSE_COL){
      if(e.range.getValue()===true){e.range.setValue(false);sheet.hideSheet();}
    }
    return;
  }

  if(sn.indexOf(CONFIG.PERSONAL_CHANGE_PREFIX)===0){
    if(row===CONFIG.PERSONAL_CHANGE_CLOSE_ROW&&col===CONFIG.PERSONAL_CHANGE_CLOSE_COL){
      if(e.range.getValue()===true){e.range.setValue(false);sheet.hideSheet();}
    }
    return;
  }

  if(!isHistorySheet_(sn))return;
  if(col!==10||row<2)return;
  var rawVal=e.range.getValue(),checked=(rawVal===true||rawVal==="TRUE");
  var status=String(sheet.getRange(row,HIST_COL.STATUS+1).getValue()).trim();
  try{
    if(checked&&status!=="承認済")applyChangeRow_(ss,sheet,row,getColors_());
    else if(!checked&&status==="承認済")revokeChangeRow_(ss,sheet,row,getColors_());
  }catch(err){
    e.range.setValue(!checked);
    SpreadsheetApp.getUi().alert("エラー","処理中にエラーが発生しました:\n"+err.message,SpreadsheetApp.getUi().ButtonSet.OK);
  }
}


// ============================================================
//  16. Googleカレンダー連携
// ============================================================
function createCalendarEvent_(calId,date,name,wt,st,et){
  try{
    var cal=CalendarApp.getCalendarById(calId);if(!cal)return;
    var title="【"+wt+"】"+name;
    if(st instanceof Date&&et instanceof Date)cal.createEvent(title,st,et,{description:"種別: "+wt+"\n名前: "+name});
    else cal.createAllDayEvent(title,date,{description:"種別: "+wt+"\n名前: "+name});
  }catch(e){Logger.log("カレンダー作成エラー ("+calId+"): "+e.message);}
}
function deleteCalendarEvent_(calId,date,name){
  try{
    var cal=CalendarApp.getCalendarById(calId);if(!cal)return;
    var evs=cal.getEventsForDay(date);
    for(var i=0;i<evs.length;i++){if(evs[i].getTitle().indexOf(name)!==-1)evs[i].deleteEvent();}
  }catch(e){Logger.log("カレンダー削除エラー ("+calId+"): "+e.message);}
}


// ============================================================
//  17. 管理者タブ ★v15.0: B列=メール / C列=カレンダーID追加
// ============================================================
function setupAdminSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var sheet=ss.getSheetByName(CONFIG.ADMIN_SHEET);
  var calId="primary",pw="IB",savedColors={office:CONFIG.DEFAULT_COLOR_OFFICE,remote:CONFIG.DEFAULT_COLOR_REMOTE,
    officeReq:CONFIG.DEFAULT_COLOR_OFFICE_REQ,remoteReq:CONFIG.DEFAULT_COLOR_REMOTE_REQ,pcOffice:CONFIG.DEFAULT_COLOR_PC_OFFICE};
  var members=[],memberEmails=[],memberCals=[];
  if(sheet){
    if(!checkPassword_()){ui.alert("エラー","パスワードが正しくありません。",ui.ButtonSet.OK);return;}
    calId=String(sheet.getRange(CONFIG.CAL_ID_VALUE_CELL).getValue()).trim()||"primary";
    var pwv=String(sheet.getRange(CONFIG.PASSWORD_CELL).getValue()).trim();pw=pwv||"IB";
    try{var mp={office:CONFIG.COLOR_OFFICE_CELL,remote:CONFIG.COLOR_REMOTE_CELL,officeReq:CONFIG.COLOR_OFFICE_REQ_CELL,remoteReq:CONFIG.COLOR_REMOTE_REQ_CELL,pcOffice:CONFIG.COLOR_PC_OFFICE_CELL};
      for(var k in mp){var bg=sheet.getRange(mp[k]).getBackground();if(bg)savedColors[k]=bg;}}catch(e){}
    var lr=sheet.getLastRow();
    if(lr>=2){
      var mdata=sheet.getRange(2,1,lr-1,3).getValues();
      for(var i=0;i<mdata.length;i++){
        var n=String(mdata[i][0]).trim();if(!n)continue;
        members.push(n);memberEmails.push(String(mdata[i][1]).trim());memberCals.push(String(mdata[i][2]).trim());
      }
    }
    if(ui.alert("確認","「管理者」タブを初期化しますか？\n（設定値・メンバー・メール・パスワードは保持）",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
    sheet.clear();sheet.getRange(1,1,sheet.getMaxRows(),sheet.getMaxColumns()).clearDataValidations();
  }else{sheet=ss.insertSheet(CONFIG.ADMIN_SHEET,0);}
  if(members.length===0){members=["山田太郎","佐藤花子","鈴木一郎"];memberEmails=["","",""];memberCals=["","",""];}

  // ---- A列: メンバー名 ----
  sheet.getRange("A1").setValue("メンバー名").setFontWeight("bold").setBackground("#4A86C8").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  // ---- B列: メールアドレス ----
  sheet.getRange("B1").setValue("メールアドレス").setFontWeight("bold").setBackground("#1565C0").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  // ---- C列: カレンダーID（省略可）----
  sheet.getRange("C1").setValue("カレンダーID（省略可）").setFontWeight("bold").setBackground("#0D47A1").setFontColor("#FFFFFF").setHorizontalAlignment("center");

  for(var i=0;i<members.length;i++){
    sheet.getRange(i+2,1).setValue(members[i]);
    sheet.getRange(i+2,2).setValue(memberEmails[i]||"").setBackground("#EEF5FF");
    sheet.getRange(i+2,3).setValue(memberCals[i]||"").setBackground("#E8EAF6").setFontColor("#555").setFontSize(9);
  }

  // ---- D列: 説明 ----
  sheet.getRange("D1").setValue("← A列: 名前 / B列: Googleメール / C列: カレンダーID（省略→メール）").setFontColor("#888").setFontSize(9);
  sheet.getRange("D2").setValue("カレンダーは: メール=プライマリ, xxx@group.calendar.google.com=共有カレンダー").setFontColor("#1565C0").setFontSize(9);
  sheet.getRange("D3").setValue("メンバー追加・削除後は「メンバー変更を反映」を実行してください").setFontColor("#888").setFontSize(9);

  // ---- E列: グローバルカレンダーID（フォールバック）----
  sheet.getRange("E1").setValue("グローバルカレンダーID").setFontWeight("bold").setBackground("#E8740C").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  sheet.getRange("E2").setValue(calId).setBackground("#FFF3E0").setFontWeight("bold").setBorder(true,true,true,true,false,false,"#E8740C",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange("E4").setValue("■ primary = 自分のメインカレンダー").setFontColor("#888").setFontSize(9);
  sheet.getRange("E5").setValue("■ B列のメールが設定されていればそちらが優先").setFontColor("#1565C0").setFontSize(9).setFontWeight("bold");
  sheet.getRange("E6").setValue("■ 共有カレンダーID例: abc@group.calendar.google.com").setFontColor("#888").setFontSize(9);

  // ---- セル色設定 ----
  var colorDefs=[
    {cell:CONFIG.COLOR_OFFICE_CELL,label:"■ 出社",color:savedColors.office},
    {cell:CONFIG.COLOR_REMOTE_CELL,label:"■ リモート",color:savedColors.remote},
    {cell:CONFIG.COLOR_OFFICE_REQ_CELL,label:"■ 出社申請",color:savedColors.officeReq},
    {cell:CONFIG.COLOR_REMOTE_REQ_CELL,label:"■ リモート申請",color:savedColors.remoteReq},
    {cell:CONFIG.COLOR_PC_OFFICE_CELL,label:"■ PC持参出社",color:savedColors.pcOffice}
  ];
  for(var i=0;i<colorDefs.length;i++){
    sheet.getRange(colorDefs[i].cell).setValue(colorDefs[i].label).setFontWeight("bold").setHorizontalAlignment("center")
      .setBackground(colorDefs[i].color).setFontColor("#333333").setBorder(true,true,true,true,false,false,"#2E7D32",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }
  sheet.getRange("E18").setValue("セル色変更後「セル色を一括更新」で既存セルにも反映").setFontColor("#E8740C").setFontWeight("bold").setFontSize(9);

  // ---- G列: パスワード ----
  sheet.getRange("G1").setValue("🔑 パスワード").setFontWeight("bold").setBackground("#7B1FA2").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  sheet.getRange("G2").setValue(pw).setFontWeight("bold").setBackground("#F3E5F5").setFontSize(14).setHorizontalAlignment("center").setBorder(true,true,true,true,false,false,"#7B1FA2",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange("G3").setValue("↑ 現在のパスワード（初期値: IB）").setFontColor("#888").setFontSize(9);
  sheet.getRange("G4").setValue("変更: メニュー「🔑 パスワード変更」").setFontColor("#7B1FA2").setFontSize(9).setFontWeight("bold");

  // ---- H-I列: シフト削除 ----
  sheet.getRange("H1:I1").merge().setValue("🗑️ シフト削除（管理者）").setFontWeight("bold").setBackground("#D44A4A").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  sheet.getRange("H2").setValue("削除する日付").setFontWeight("bold").setBackground("#FDEAEA").setHorizontalAlignment("center").setBorder(true,true,true,true,false,false,"#D44A4A",SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("I2").setValue("メンバー名").setFontWeight("bold").setBackground("#FDEAEA").setHorizontalAlignment("center").setBorder(true,true,true,true,false,false,"#D44A4A",SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("H3").setNumberFormat("yyyy/mm/dd").setBackground("#FFF8F8").setFontSize(11).setBorder(true,true,true,true,false,false,"#D44A4A",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sheet.getRange("I3").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(members).setAllowInvalid(false).build()).setBackground("#FFF8F8").setFontSize(11).setBorder(true,true,true,true,false,false,"#D44A4A",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  [150,200,180,350,220,30,120,130,160].forEach(function(w,i){sheet.setColumnWidth(i+1,w);});
  sheet.hideSheet();
  ui.alert("管理者タブ作成完了",
    "「管理者」タブを作成しました。\n\n" +
    "【A列】メンバー名\n" +
    "【B列】Googleメールアドレス（カレンダー連携に必須）\n" +
    "【C列】カレンダーID（省略するとB列メールのプライマリカレンダーを使用）\n" +
    "【E2】グローバルカレンダーID（B/C列未設定の場合のフォールバック）\n" +
    "【G2】パスワード（初期値: IB）\n\n" +
    "※ タブ確認・編集はメニュー「🔑 管理者タブを表示」を使用してください\n" +
    "※ Webアプリは「Execute as: User accessing the web app」でデプロイすると\n" +
    "  各ユーザーのCalendarAppが自動的に自分のカレンダーを使用します",
    ui.ButtonSet.OK);
}


// ============================================================
//  18. 変更履歴タブ
// ============================================================
function setupChangeHistorySheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var ex=getAllHistorySheets_(ss);
  if(ex.length>0){if(!checkPassword_())return;if(ui.alert("確認","「変更履歴」タブ（"+ex.length+"枚）を全て初期化しますか？",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;for(var i=0;i<ex.length;i++)ss.deleteSheet(ex[i]);}
  createHistorySheetInternal_(CONFIG.CHANGE_HISTORY_SHEET);
  ui.alert("変更履歴タブ作成完了","「変更履歴」タブを作成しました。\n\nJ列: 承認チェックボックス / L列: 処理状態\n表示: メニュー「📋 変更履歴を表示」",ui.ButtonSet.OK);
}
function showChangeHistorySheets(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var sheets=getAllHistorySheets_(ss);if(sheets.length===0){ui.alert("エラー","「変更履歴」タブが存在しません。",ui.ButtonSet.OK);return;}
  if(!checkPassword_())return;for(var i=0;i<sheets.length;i++)sheets[i].showSheet();
  ss.setActiveSheet(sheets[0]);ui.alert("表示完了","「変更履歴」タブ（"+sheets.length+"枚）を表示しました。",ui.ButtonSet.OK);
}
function hideChangeHistorySheets(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var sheets=getAllHistorySheets_(ss);if(sheets.length===0){ui.alert("エラー","「変更履歴」タブが存在しません。",ui.ButtonSet.OK);return;}
  for(var i=0;i<sheets.length;i++)sheets[i].hideSheet();ui.alert("非表示完了","「変更履歴」タブを非表示にしました。",ui.ButtonSet.OK);
}
function showChangeHistorySheet(){showChangeHistorySheets();}
function hideChangeHistorySheet(){hideChangeHistorySheets();}


// ============================================================
//  19. 反映タブ（前月21日〜当月20日）
// ============================================================
function setupAllReflectionSheets(){
  var ui=SpreadsheetApp.getUi(),members=getMembers_();
  if(members.length===0){ui.alert("エラー","「管理者」タブに名前が登録されていません。",ui.ButtonSet.OK);return;}
  var r=ui.prompt("反映タブ作成","対象年を入力してください（例: 2026）",ui.ButtonSet.OK_CANCEL);
  if(r.getSelectedButton()!==ui.Button.OK)return;
  var year=parseInt(r.getResponseText(),10);
  if(isNaN(year)||year<2000||year>2100){ui.alert("正しい年を入力してください。");return;}
  for(var m=1;m<=12;m++)createReflectionSheet_(year,m,members);
  ui.alert(year+"年の全月反映タブを作成しました。\n各タブは前月21日〜当月20日の構成です。");
}
function createReflectionSheet_(year,month,members){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sn=month+CONFIG.REFLECTION_SUFFIX;
  var sh=ss.getSheetByName(sn);if(sh)ss.deleteSheet(sh);sh=ss.insertSheet(sn);
  var dr=getDateRangeForSheet_(year,month),td=dr.totalDays;
  var dns=["日","月","火","水","木","金","土"],r1=[year+"年"+month+"月度"],r2=[""],dates=[];
  for(var i=0;i<td;i++){var d=new Date(dr.startDate);d.setDate(d.getDate()+i);dates.push(new Date(d));r1.push((d.getMonth()+1)+"/"+d.getDate());r2.push(dns[d.getDay()]);}
  sh.getRange(1,1,1,r1.length).setValues([r1]).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#4A86C8").setFontColor("#FFFFFF");
  sh.getRange(2,1,1,r2.length).setValues([r2]).setFontSize(9).setHorizontalAlignment("center").setBackground("#E8EEF7");
  for(var i=0;i<td;i++){var dw=dates[i].getDay(),c=i+2;
    if(dw===0){sh.getRange(1,c).setBackground("#D44A4A");sh.getRange(2,c).setBackground("#FFE0E0").setFontColor("#CC0000");}
    else if(dw===6){sh.getRange(1,c).setBackground("#3A6DB5");sh.getRange(2,c).setBackground("#E0E0FF").setFontColor("#0000CC");}
  }
  var md=members.map(function(n){return[n];});
  sh.getRange(3,1,md.length,1).setValues(md).setFontWeight("bold").setBackground("#F5F5F5").setHorizontalAlignment("left");
  sh.getRange(3,2,md.length,td).setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(8);
  sh.getRange(1,1,md.length+2,td+1).setBorder(true,true,true,true,true,true,"#CCCCCC",SpreadsheetApp.BorderStyle.SOLID);
  sh.setColumnWidth(1,120);for(var i=0;i<td;i++)sh.setColumnWidth(i+2,78);
  for(var r=3;r<3+md.length;r++)sh.setRowHeight(r,28);
  sh.setFrozenColumns(1);sh.setFrozenRows(2);
}


// ============================================================
//  20. メンバー同期 ★v15.0: B・C列（メール・カレンダー）も保持
// ============================================================
function syncMembers(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi(),members=getMembers_();
  if(members.length===0){ui.alert("エラー","「管理者」タブに名前がありません。",ui.ButtonSet.OK);return;}
  var del=[];
  for(var m=1;m<=12;m++){
    var sh=ss.getSheetByName(m+CONFIG.REFLECTION_SUFFIX);if(!sh)continue;
    var lr=sh.getLastRow();if(lr<3)continue;
    var ex=sh.getRange(3,1,lr-2,1).getValues().map(function(r){return String(r[0]).trim();}).filter(function(n){return n!=="";});
    for(var i=0;i<ex.length;i++){if(members.indexOf(ex[i])===-1&&del.indexOf(ex[i])===-1)del.push(ex[i]);}
  }
  if(del.length>0){
    if(ui.alert("メンバー削除の確認","以下を反映タブから削除しますか？\n\n"+del.map(function(n){return"・"+n;}).join("\n"),ui.ButtonSet.YES_NO)!==ui.Button.YES){
      var res=syncMembers_addOnly_(ss,members);updateDropdownsForMembers_(ss,members);setupHubSheet_silent_(members);
      ui.alert("追加のみ完了","追加: "+res.addedCount+" 件",ui.ButtonSet.OK);return;
    }
  }
  var dc=0;
  for(var m=1;m<=12;m++){
    var sh=ss.getSheetByName(m+CONFIG.REFLECTION_SUFFIX);if(!sh)continue;
    var lr=sh.getLastRow();if(lr<3)continue;
    var names=sh.getRange(3,1,lr-2,1).getValues();
    for(var i=names.length-1;i>=0;i--){if(String(names[i][0]).trim()!==""&&members.indexOf(String(names[i][0]).trim())===-1){sh.deleteRow(i+3);dc++;}}
  }
  var ar=syncMembers_addOnly_(ss,members);updateDropdownsForMembers_(ss,members);setupHubSheet_silent_(members);
  ui.alert("メンバー変更を反映しました","追加: "+ar.addedCount+" 件\n削除: "+dc+" 件\n\n新規メンバー分は「初期設定：個人シート作成（全員分）」を実行してください。",ui.ButtonSet.OK);
}
function updateDropdownsForMembers_(ss,members){
  var r=SpreadsheetApp.newDataValidation().requireValueInList(members).setAllowInvalid(false).build();
  var as=ss.getSheetByName(CONFIG.ADMIN_SHEET);if(as)as.getRange(CONFIG.DELETE_NAME_CELL).setDataValidation(r);
}
function syncMembers_addOnly_(ss,members){
  var ac=0;
  for(var m=1;m<=12;m++){
    var sh=ss.getSheetByName(m+CONFIG.REFLECTION_SUFFIX);if(!sh)continue;
    var lr=sh.getLastRow(),ex=lr>=3?sh.getRange(3,1,lr-2,1).getValues().map(function(r){return String(r[0]).trim();}) :[];
    for(var i=0;i<members.length;i++){if(ex.indexOf(members[i])===-1){var nr=sh.getLastRow()+1;sh.getRange(nr,1).setValue(members[i]).setFontWeight("bold").setBackground("#F5F5F5");sh.setRowHeight(nr,28);ac++;}}
  }
  return{addedCount:ac};
}


// ============================================================
//  21. 設定確認 ★v15.0: メンバー別カレンダー設定も表示
// ============================================================
function verifySettings(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var s=ss.getSheetByName(CONFIG.ADMIN_SHEET);if(!s){ui.alert("エラー","「管理者」タブが見つかりません。",ui.ButtonSet.OK);return;}
  var calId=getCalendarId_(),colors=getColors_();
  var calSt="",calHelp="";
  try{var cal=CalendarApp.getCalendarById(calId);calSt=cal?"✅ 接続OK（"+cal.getName()+"）":"❌ アクセスできません";if(!cal)calHelp="→ カレンダーIDと共有設定を確認してください。";}
  catch(e){calSt="❌ エラー: "+e.message;calHelp="→ カレンダーIDが間違っているか、アクセス権がありません。";}

  // メンバー別カレンダーの確認
  var members=getMembers_(),memberCalInfo=[],missing=[];
  var lr=s.getLastRow();
  if(lr>=2){
    var mdata=s.getRange(2,1,lr-1,3).getValues();
    for(var i=0;i<mdata.length;i++){
      var n=String(mdata[i][0]).trim();if(!n)continue;
      var email=String(mdata[i][1]).trim(),customCal=String(mdata[i][2]).trim();
      var resolvedCal=customCal||email||calId;
      memberCalInfo.push(n+": "+(customCal?customCal:email?"メール("+email+"）":("グローバル("+calId+")")));
    }
  }
  for(var i=0;i<members.length;i++){
    if(!ss.getSheetByName(CONFIG.PERSONAL_INPUT_PREFIX+members[i]))missing.push(members[i]+"（入力シートなし）");
    if(!ss.getSheetByName(CONFIG.PERSONAL_CHANGE_PREFIX+members[i]))missing.push(members[i]+"（変更シートなし）");
  }

  var msg="【グローバルカレンダー（フォールバック）】\n  ID: "+calId+"\n  "+calSt;
  if(calHelp)msg+="\n  "+calHelp;
  msg+="\n\n【メンバー別カレンダー設定】\n  "+memberCalInfo.join("\n  ");
  msg+="\n\n【セル色】\n  出社: "+colors.office+"\n  リモート: "+colors.remote+"\n  出社申請: "+colors.officeReq+"\n  リモート申請: "+colors.remoteReq+"\n  PC持参出社: "+colors.pcOffice;
  msg+="\n\n【月の区切り】前月21日〜当月20日";
  msg+="\n\n【個人シート】\n  "+(missing.length===0?"✅ 全員分あり":"⚠️ 未作成: "+missing.join(", "));
  msg+="\n\n【ハブシート】\n  勤怠管理: "+(ss.getSheetByName(CONFIG.HUB_SHEET)?"✅":"❌ 未作成");
  msg+="\n  月管理: "+(ss.getSheetByName(CONFIG.MONTH_HUB_SHEET)?"✅":"❌ 未作成");
  msg+="\n\n【Webアプリ推奨デプロイ設定】\n  Execute as: User accessing the web app\n  Access: Anyone with Google Account";
  ui.alert("設定の確認",msg,ui.ButtonSet.OK);
}


// ============================================================
//  22. セル色を一括更新
// ============================================================
function applyColorsToAll(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi(),colors=getColors_();
  if(ui.alert("セル色の一括更新","全反映タブのセル色を更新します。\n実行しますか？",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  var uc=0,nc=0;
  for(var m=1;m<=12;m++){
    var sh=ss.getSheetByName(m+CONFIG.REFLECTION_SUFFIX);if(!sh)continue;
    var lr=sh.getLastRow();if(lr<3)continue;
    var ym=String(sh.getRange(1,1).getValue()).match(/(\d{4})/);
    var year=ym?parseInt(ym[1],10):2026;
    var dr=getDateRangeForSheet_(year,m),td=dr.totalDays,mc=lr-2;
    var dataR=sh.getRange(3,2,mc,td);
    var vals=dataR.getValues(),notes=dataR.getNotes(),bgs=dataR.getBackgrounds();
    var nb=bgs.map(function(r){return r.slice();}),nn=notes.map(function(r){return r.slice();});
    var hbc=false,hnc=false;
    for(var r=0;r<mc;r++){for(var c=0;c<td;c++){
      if(!String(vals[r][c]).trim())continue;
      var note=String(notes[r][c]).trim(),ct=getTypeFromNote_(note);
      if(!ct){ct=guessTypeFromColor_(bgs[r][c],colors);nn[r][c]=ct+(note.indexOf(NOTE_CAL_SUFFIX)!==-1?NOTE_CAL_SUFFIX:"");hnc=true;nc++;}
      var tg=colors.office;
      if(ct==="リモート")tg=colors.remote;else if(ct==="PC持参出社"||ct==="PC持参出社申請")tg=colors.pcOffice;
      else if(ct==="出社申請")tg=colors.officeReq;else if(ct==="リモート申請")tg=colors.remoteReq;
      if(bgs[r][c].toUpperCase()!==tg.toUpperCase()){nb[r][c]=tg;hbc=true;uc++;}
    }}
    if(hbc)dataR.setBackgrounds(nb);if(hnc)dataR.setNotes(nn);
  }
  var msg="✅ 色を更新: "+uc+" 個";if(nc>0)msg+="\nℹ️ 種別ノートを追加: "+nc+" 個";if(uc===0)msg+="\n（変更なし）";
  ui.alert("セル色の一括更新",msg,ui.ButtonSet.OK);
}


// ============================================================
//  23. 勤怠管理ハブシート
// ============================================================
function setupHubSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi(),members=getMembers_();
  if(members.length===0){ui.alert("エラー","「管理者」タブに名前が登録されていません。",ui.ButtonSet.OK);return;}
  buildHubSheet_(ss,members);
  ui.alert("勤怠管理タブ作成完了",
    "「勤怠管理」タブを作成しました。\n\n" +
    "① B3で自分の名前を選択\n" +
    "② 📝 入力シートへ または 🔄 変更シートへ にチェック\n\n" +
    "【閉じ方】\n" +
    "各シートの G2（入力）/ K2（変更）にチェックを入れると\n" +
    "そのシートだけが非表示になります。\n\n" +
    "※ チェックボックスには「⚙️ チェックボックス自動処理トリガー設定」が必要です",
    ui.ButtonSet.OK);
}

function buildHubSheet_(ss,members){
  var sh=ss.getSheetByName(CONFIG.HUB_SHEET);
  if(sh){sh.clear();sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();}
  else{sh=ss.insertSheet(CONFIG.HUB_SHEET,0);}
  sh.getRange("A1:F1").merge().setValue("🏢  勤怠管理システム")
    .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#4A86C8").setFontColor("#FFFFFF");
  sh.getRange("A3").setValue("👤  あなたの名前").setFontSize(12).setFontWeight("bold").setFontColor("#333333").setHorizontalAlignment("right").setVerticalAlignment("middle");
  sh.getRange("B3").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(members).setAllowInvalid(false).build())
    .setBackground("#FFF9E6").setFontSize(13).setFontWeight("bold").setBorder(true,true,true,true,false,false,"#E8740C",SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.getRange("D3").insertCheckboxes().setValue(false).setBackground("#E3F2FD").setBorder(true,true,true,true,false,false,"#1565C0",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange("E3").setValue("📝  入力シートへ").setFontSize(12).setFontWeight("bold").setFontColor("#1565C0").setHorizontalAlignment("left").setVerticalAlignment("middle");
  sh.getRange("D4").insertCheckboxes().setValue(false).setBackground("#FCE4EC").setBorder(true,true,true,true,false,false,"#C62828",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange("E4").setValue("🔄  変更シートへ").setFontSize(12).setFontWeight("bold").setFontColor("#C62828").setHorizontalAlignment("left").setVerticalAlignment("middle");
  sh.getRange("A6:F6").merge().setValue("【使い方】").setFontWeight("bold").setFontColor("#555555").setFontSize(11);
  sh.getRange("A7:F7").merge().setValue("① B3セルで自分の名前を選択 → ② 📝 または 🔄 にチェック → そのシートへ移動").setFontColor("#1565C0").setFontSize(10).setFontWeight("bold");
  sh.getRange("A8:F8").merge().setValue("③ データ入力後、メニュー「▶ 入力実行」または「▶ 変更実行」を実行").setFontColor("#333333").setFontSize(10);
  sh.getRange("A9:F9").merge().setValue("④ 月のシフト確認は「月管理」タブから").setFontColor("#2E7D32").setFontSize(10).setFontWeight("bold");
  sh.getRange("A11:F11").merge().setValue("【シートの閉じ方】入力シート G2 または 変更シート K2 のチェックボックスにチェックを入れるとそのシートが非表示になります").setFontColor("#FF6F00").setFontSize(9).setFontWeight("bold");
  sh.getRange("A12:F12").merge().setValue("※ 他の人がシートを開いていても影響しません。それぞれが自分のシートを自分で開閉できます").setFontColor("#888888").setFontSize(9);
  sh.getRange("A13:F13").merge().setValue("※ Webフォームからも申請できます。Webアプリは「Execute as: User accessing the web app」でデプロイしてください").setFontColor("#E8740C").setFontSize(9);
  [160,180,20,40,200,30].forEach(function(w,i){sh.setColumnWidth(i+1,w);});
  sh.setRowHeight(1,50);sh.setRowHeight(3,36);sh.setRowHeight(4,36);
  ss.setActiveSheet(sh);return sh;
}

function setupHubSheet_silent_(members){
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HUB_SHEET);if(!sh)return;
  sh.getRange(CONFIG.HUB_NAME_CELL).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(members).setAllowInvalid(false).build());
}


// ============================================================
//  24. 月管理シート
// ============================================================
function setupMonthHubSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  buildMonthHubSheet_(ss);
  ui.alert("月管理タブ作成完了","「月管理」タブを作成しました。\n\n① B3で月（1〜12）を選択\n② 「📅 月反映シートへ」にチェック → その月の反映シートへ移動",ui.ButtonSet.OK);
}

function buildMonthHubSheet_(ss){
  var sh=ss.getSheetByName(CONFIG.MONTH_HUB_SHEET);
  if(sh){sh.clear();sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();}
  else{sh=ss.insertSheet(CONFIG.MONTH_HUB_SHEET);}
  sh.getRange("A1:F1").merge().setValue("📅  月反映シート管理")
    .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#2E7D32").setFontColor("#FFFFFF");
  sh.getRange("A3").setValue("📅  確認する月").setFontSize(12).setFontWeight("bold").setFontColor("#333333").setHorizontalAlignment("right").setVerticalAlignment("middle");
  sh.getRange("B3").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["1","2","3","4","5","6","7","8","9","10","11","12"]).setAllowInvalid(false).build())
    .setBackground("#E8F5E9").setFontSize(16).setFontWeight("bold").setBorder(true,true,true,true,false,false,"#2E7D32",SpreadsheetApp.BorderStyle.SOLID_MEDIUM).setHorizontalAlignment("center").setVerticalAlignment("middle");
  sh.getRange("C3").setValue("月").setFontSize(13).setFontWeight("bold").setFontColor("#2E7D32").setVerticalAlignment("middle");
  sh.getRange("D3").insertCheckboxes().setValue(false).setBackground("#E8F5E9").setBorder(true,true,true,true,false,false,"#2E7D32",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange("E3").setValue("📅  月反映シートへ移動").setFontSize(12).setFontWeight("bold").setFontColor("#2E7D32").setHorizontalAlignment("left").setVerticalAlignment("middle");
  sh.getRange("A5:F5").merge().setValue("【月別 反映シート一覧（前月21日〜当月20日）】").setFontWeight("bold").setFontColor("#555555").setFontSize(11);
  var mns=["1月（前年12/21〜1/20）","2月（1/21〜2/20）","3月（2/21〜3/20）","4月（3/21〜4/20）","5月（4/21〜5/20）","6月（5/21〜6/20）","7月（6/21〜7/20）","8月（7/21〜8/20）","9月（8/21〜9/20）","10月（9/21〜10/20）","11月（10/21〜11/20）","12月（11/21〜12/20）"];
  for(var i=0;i<12;i++){var r=6+Math.floor(i/3),c=(i%3)*2+1;
    sh.getRange(r,c).setValue((i+1)+"月").setFontWeight("bold").setHorizontalAlignment("center").setBackground("#C8E6C9").setFontColor("#1B5E20").setBorder(true,true,true,true,false,false,"#81C784",SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(r,c+1).setValue(mns[i]).setFontColor("#555555").setFontSize(9).setBorder(true,true,true,true,false,false,"#81C784",SpreadsheetApp.BorderStyle.SOLID);
  }
  sh.getRange("A10:F10").merge().setValue("※ 月反映シートは常時表示されています。シートタブを直接クリックしても移動できます。").setFontColor("#888888").setFontSize(9);
  [120,120,30,40,200,30].forEach(function(w,i){sh.setColumnWidth(i+1,w);});
  sh.setRowHeight(1,50);sh.setRowHeight(3,40);for(var r=6;r<=9;r++)sh.setRowHeight(r,28);
  ss.setActiveSheet(sh);return sh;
}


// ============================================================
//  25. 個人シート
// ============================================================
function setupAllPersonalSheets(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi(),members=getMembers_();
  if(members.length===0){ui.alert("エラー","「管理者」タブに名前が登録されていません。",ui.ButtonSet.OK);return;}
  if(ui.alert("確認",members.length+"名分の個人シートを作成します。\n実行しますか？",ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
  for(var i=0;i<members.length;i++){setupPersonalInputSheet_(members[i]);setupPersonalChangeSheet_(members[i]);}
  ui.alert("個人シート作成完了",members.length+"名分の個人シートを作成しました（全て非表示状態）。\n\n【開き方】「勤怠管理」タブで名前を選んでチェック\n【閉じ方】入力シートは G2 / 変更シートは K2 にチェック",ui.ButtonSet.OK);
}

function setupPersonalInputSheet_(name){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sn=CONFIG.PERSONAL_INPUT_PREFIX+name;
  var sh=ss.getSheetByName(sn);
  if(sh){sh.clear();sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();}
  else{sh=ss.insertSheet(sn);}
  var headers=["日付","開始時間","終了時間","種別","名前","操作"];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight("bold").setBackground("#4A86C8").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  for(var r=2;r<=2+CONFIG.INPUT_MAX_ROWS-1;r++){
    sh.getRange(r,1).setNumberFormat("yyyy/mm/dd");sh.getRange(r,2).setNumberFormat("HH:mm");sh.getRange(r,3).setNumberFormat("HH:mm");
    sh.getRange(r,4).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["出社申請","リモート申請","PC持参出社申請"]).setAllowInvalid(false).build());
  }
  sh.getRange("E2").setValue(name).setBackground("#D0E8FF").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,false,false,"#4A86C8",SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange("E3").setValue("← "+name+" 専用").setFontColor("#4A86C8").setFontSize(9);
  sh.getRange("F2").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["作成","削除"]).setAllowInvalid(false).build()).setBackground("#E8F5E9");
  sh.getRange(2,1,CONFIG.INPUT_MAX_ROWS,4).setBackground("#FFF9E6");
  sh.getRange("G1").setValue("🚪 完了・閉じる").setFontSize(10).setFontWeight("bold").setFontColor("#FF6F00").setHorizontalAlignment("center").setBackground("#FFF3E0").setBorder(true,true,true,true,false,false,"#FF6F00",SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange("G2").insertCheckboxes().setValue(false).setBackground("#FFF3E0").setBorder(true,true,true,true,false,false,"#FF6F00",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange("G3").setValue("↑チェックで非表示").setFontSize(8).setFontColor("#FF6F00").setHorizontalAlignment("center");
  sh.getRange("G4").setValue("他の人に").setFontSize(8).setFontColor("#aaaaaa").setHorizontalAlignment("center");
  sh.getRange("G5").setValue("影響しない").setFontSize(8).setFontColor("#aaaaaa").setHorizontalAlignment("center");
  sh.getRange("A8").setValue("【"+name+" 専用 入力シート】").setFontWeight("bold").setFontColor("#4A86C8").setFontSize(10);
  sh.getRange("A9").setValue("① 日付・時間・種別を入力（最大5日分）　② F2「操作」で作成か削除を選択　③ メニュー「▶ 入力実行」を実行").setFontColor("#555555").setFontSize(9);
  sh.getRange("A10").setValue("作業が終わったら G2 のチェックボックスにチェックを入れてシートを閉じてください").setFontColor("#FF6F00").setFontSize(9).setFontWeight("bold");
  [120,90,90,130,120,80,90].forEach(function(w,i){sh.setColumnWidth(i+1,w);});
  sh.hideSheet();return sh;
}

function setupPersonalChangeSheet_(name){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),sn=CONFIG.PERSONAL_CHANGE_PREFIX+name;
  var sh=ss.getSheetByName(sn);
  if(sh){sh.clear();sh.getRange(1,1,sh.getMaxRows(),sh.getMaxColumns()).clearDataValidations();}
  else{sh=ss.insertSheet(sn);}
  var headers=["変更前日付","変更前開始","変更前終了","変更後日付","変更後開始","変更後終了","種別","変更理由","理由詳細（自由記述）","名前（共通）"];
  sh.getRange(1,1,1,headers.length).setValues([headers]).setFontWeight("bold").setBackground("#D44A4A").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  for(var r=2;r<=2+CONFIG.CHANGE_MAX_ROWS-1;r++){
    sh.getRange(r,1).setNumberFormat("yyyy/mm/dd");sh.getRange(r,2).setNumberFormat("HH:mm");sh.getRange(r,3).setNumberFormat("HH:mm");
    sh.getRange(r,4).setNumberFormat("yyyy/mm/dd");sh.getRange(r,5).setNumberFormat("HH:mm");sh.getRange(r,6).setNumberFormat("HH:mm");
    sh.getRange(r,7).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["出社","リモート","PC持参出社"]).setAllowInvalid(false).build());
    sh.getRange(r,8).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["病気","その他"]).setAllowInvalid(false).build());
  }
  sh.getRange("J2").setValue(name).setBackground("#D0E8FF").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,false,false,"#4A86C8",SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange("J3").setValue("← "+name+" 専用").setFontColor("#4A86C8").setFontSize(9);
  sh.getRange(2,1,CONFIG.CHANGE_MAX_ROWS,3).setBackground("#FFF0F0");
  sh.getRange(2,4,CONFIG.CHANGE_MAX_ROWS,3).setBackground("#E8F5E9");
  sh.getRange(2,7,CONFIG.CHANGE_MAX_ROWS,1).setBackground("#FFF9E6");
  sh.getRange(2,8,CONFIG.CHANGE_MAX_ROWS,2).setBackground("#F3E5F5");
  sh.getRange("K1").setValue("🚪 完了・閉じる").setFontSize(10).setFontWeight("bold").setFontColor("#FF6F00").setHorizontalAlignment("center").setBackground("#FFF3E0").setBorder(true,true,true,true,false,false,"#FF6F00",SpreadsheetApp.BorderStyle.SOLID);
  sh.getRange("K2").insertCheckboxes().setValue(false).setBackground("#FFF3E0").setBorder(true,true,true,true,false,false,"#FF6F00",SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange("K3").setValue("↑チェックで非表示").setFontSize(8).setFontColor("#FF6F00").setHorizontalAlignment("center");
  sh.getRange("K4").setValue("他の人に").setFontSize(8).setFontColor("#aaaaaa").setHorizontalAlignment("center");
  sh.getRange("K5").setValue("影響しない").setFontSize(8).setFontColor("#aaaaaa").setHorizontalAlignment("center");
  sh.getRange("A8").setValue("【"+name+" 専用 変更シート】").setFontWeight("bold").setFontColor("#D44A4A").setFontSize(10);
  sh.getRange("A9").setValue("変更前のみ→削除申請 / 変更後のみ→追加申請 / 両方→変更申請 | G列（種別）: 出社 / リモート / PC持参出社").setFontColor("#D44A4A").setFontSize(9).setFontWeight("bold");
  sh.getRange("A10").setValue("作業が終わったら K2 のチェックボックスにチェックを入れてシートを閉じてください").setFontColor("#FF6F00").setFontSize(9).setFontWeight("bold");
  [110,80,80,110,80,80,100,90,160,110,90].forEach(function(w,i){sh.setColumnWidth(i+1,w);});
  sh.hideSheet();return sh;
}


// ============================================================
//  26. ナビゲーション関数
// ============================================================
function navigateToMyInputSheet_fromHub_(hubSheet){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var name=String(hubSheet.getRange(CONFIG.HUB_NAME_CELL).getValue()).trim();
  if(!name){ui.alert("エラー","名前を選択してから「📝 入力シートへ」にチェックを入れてください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(CONFIG.PERSONAL_INPUT_PREFIX+name);
  if(!sh){ui.alert("エラー",name+" の入力シートが見つかりません。\n「初期設定：個人シート作成（全員分）」を実行してください。",ui.ButtonSet.OK);return;}
  sh.getRange(CONFIG.PERSONAL_INPUT_CLOSE_ROW,CONFIG.PERSONAL_INPUT_CLOSE_COL).setValue(false);
  sh.showSheet();ss.setActiveSheet(sh);
}
function navigateToMyChangeSheet_fromHub_(hubSheet){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var name=String(hubSheet.getRange(CONFIG.HUB_NAME_CELL).getValue()).trim();
  if(!name){ui.alert("エラー","名前を選択してから「🔄 変更シートへ」にチェックを入れてください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(CONFIG.PERSONAL_CHANGE_PREFIX+name);
  if(!sh){ui.alert("エラー",name+" の変更シートが見つかりません。\n「初期設定：個人シート作成（全員分）」を実行してください。",ui.ButtonSet.OK);return;}
  sh.getRange(CONFIG.PERSONAL_CHANGE_CLOSE_ROW,CONFIG.PERSONAL_CHANGE_CLOSE_COL).setValue(false);
  sh.showSheet();ss.setActiveSheet(sh);
}
function navigateToMonthSheet_fromHub_(monthHubSheet){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var mv=String(monthHubSheet.getRange(CONFIG.MONTH_HUB_MONTH_CELL).getValue()).trim();
  if(!mv){ui.alert("エラー","B3セルで月を選択してから「📅 月反映シートへ移動」にチェックを入れてください。",ui.ButtonSet.OK);return;}
  var month=parseInt(mv,10);if(isNaN(month)||month<1||month>12){ui.alert("エラー","1〜12 の月を選択してください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(month+CONFIG.REFLECTION_SUFFIX);
  if(!sh){ui.alert("エラー",month+"月反映シートが見つかりません。",ui.ButtonSet.OK);return;}
  ss.setActiveSheet(sh);
}
function navigateToMyInputSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var name=getSelectedMemberFromHub_();
  if(!name){var r=ui.prompt("名前を入力","あなたの名前を入力してください:",ui.ButtonSet.OK_CANCEL);if(r.getSelectedButton()!==ui.Button.OK)return;name=r.getResponseText().trim();}
  if(!name){ui.alert("エラー","名前を入力してください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(CONFIG.PERSONAL_INPUT_PREFIX+name);
  if(!sh){ui.alert("エラー",name+" の入力シートが見つかりません。",ui.ButtonSet.OK);return;}
  sh.getRange(CONFIG.PERSONAL_INPUT_CLOSE_ROW,CONFIG.PERSONAL_INPUT_CLOSE_COL).setValue(false);
  sh.showSheet();ss.setActiveSheet(sh);
}
function navigateToMyChangeSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var name=getSelectedMemberFromHub_();
  if(!name){var r=ui.prompt("名前を入力","あなたの名前を入力してください:",ui.ButtonSet.OK_CANCEL);if(r.getSelectedButton()!==ui.Button.OK)return;name=r.getResponseText().trim();}
  if(!name){ui.alert("エラー","名前を入力してください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(CONFIG.PERSONAL_CHANGE_PREFIX+name);
  if(!sh){ui.alert("エラー",name+" の変更シートが見つかりません。",ui.ButtonSet.OK);return;}
  sh.getRange(CONFIG.PERSONAL_CHANGE_CLOSE_ROW,CONFIG.PERSONAL_CHANGE_CLOSE_COL).setValue(false);
  sh.showSheet();ss.setActiveSheet(sh);
}
function navigateToMonthSheet(){
  var ss=SpreadsheetApp.getActiveSpreadsheet(),ui=SpreadsheetApp.getUi();
  var month=getMonthFromHub_();
  if(!month){var r=ui.prompt("月を入力","移動する月を入力してください（1〜12）:",ui.ButtonSet.OK_CANCEL);if(r.getSelectedButton()!==ui.Button.OK)return;month=parseInt(r.getResponseText().trim(),10);}
  if(isNaN(month)||month<1||month>12){ui.alert("エラー","1〜12 の月を入力してください。",ui.ButtonSet.OK);return;}
  var sh=ss.getSheetByName(month+CONFIG.REFLECTION_SUFFIX);
  if(!sh){ui.alert("エラー",month+"月反映シートが見つかりません。",ui.ButtonSet.OK);return;}
  ss.setActiveSheet(sh);
}
function getSelectedMemberFromHub_(){
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.HUB_SHEET);if(!sh)return null;
  return String(sh.getRange(CONFIG.HUB_NAME_CELL).getValue()).trim()||null;
}
function getMonthFromHub_(){
  var sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.MONTH_HUB_SHEET);if(!sh)return null;
  var v=parseInt(String(sh.getRange(CONFIG.MONTH_HUB_MONTH_CELL).getValue()).trim(),10);
  return(isNaN(v)||v<1||v>12)?null:v;
}
