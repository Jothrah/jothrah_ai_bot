<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>مولد ملصق مبيد</title>

  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Tahoma, Arial, sans-serif;
      background: #e7e7e7;
      color: #111;
    }

    .app-wrap {
      width: 100%;
      min-height: 100vh;
      padding: 20px;
    }

    .form-card {
      max-width: 860px;
      margin: 0 auto 24px auto;
      background: #f3f3f3;
      border: 1px solid #d0d0d0;
      border-radius: 18px;
      padding: 28px 26px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.08);
    }

    .form-title {
      margin: 0 0 18px 0;
      text-align: center;
      font-size: 30px;
      font-weight: 700;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }

    .field {
      margin-bottom: 16px;
    }

    .field label {
      display: block;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 8px;
      color: #222;
    }

    .field input,
    .field select,
    .field textarea {
      width: 100%;
      border: 2px solid #cfcfcf;
      border-radius: 14px;
      background: #dcdcdc;
      padding: 14px 18px;
      font-size: 20px;
      font-family: inherit;
      outline: none;
    }

    .field textarea {
      min-height: 92px;
      resize: vertical;
      font-size: 17px;
      line-height: 1.6;
    }

    .field input:focus,
    .field select:focus,
    .field textarea:focus {
      border-color: #999;
      background: #e5e5e5;
    }

    .field-note {
      font-size: 13px;
      color: #666;
      margin-top: 6px;
      padding-right: 4px;
      line-height: 1.6;
    }

    .btn-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: center;
      margin-top: 20px;
    }

    .btn {
      border: none;
      border-radius: 14px;
      padding: 16px 26px;
      font-size: 22px;
      font-family: inherit;
      cursor: pointer;
      min-width: 220px;
    }

    .btn-generate {
      background: #ff4f87;
      color: #000;
      font-weight: 700;
    }

    .btn-print {
      background: #111;
      color: #fff;
      font-weight: 700;
    }

    .preview-wrap {
      max-width: 1600px;
      margin: 0 auto;
      overflow-x: auto;
    }

    .sheet {
      width: 297mm;
      height: 210mm;
      margin: 0 auto;
      background: #fff;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      padding: 6mm 5mm;
      overflow: hidden;
      position: relative;
    }

    .columns {
      direction: ltr;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      column-gap: 10px;
      height: 100%;
    }

    .col {
      direction: rtl;
      position: relative;
      padding: 4px 12px 48px 12px;
      height: 100%;
      font-size: 12px;
      line-height: 1.42;
      color: #111;
    }

    .col-left,
    .col-middle {
      border-right: 2px dashed #000;
    }

    .section-title {
      margin: 0 0 6px 0;
      color: #4a8f2f;
      font-size: 15px;
      font-weight: 700;
      line-height: 1.2;
    }

    .section-text {
      margin: 0 0 10px 0;
    }

    .section-list {
      margin: 0 0 10px 0;
      padding-right: 18px;
    }

    .section-list li {
      margin-bottom: 4px;
    }

    .top-strip {
      direction: ltr;
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      border: 2px solid #000;
      margin: 4px 0 14px 0;
      text-align: center;
      font-weight: 700;
      font-size: 15px;
    }

    .cell {
      padding: 6px;
      border-left: 1px solid #000;
    }

    .cell:first-child {
      border-left: none;
    }

    .light {
      background: #eee;
      color: #000;
    }

    .dark {
      background: #000;
      color: #fff;
    }

    .product-name-wrap {
      margin-bottom: 10px;
    }

    .product-name-wrap.powder {
      text-align: right;
    }

    .product-name-wrap.liquid {
      text-align: center;
    }

    .product-name-ar {
      color: #5f8f43;
      font-size: 30px;
      font-weight: 700;
      line-height: 1.12;
      margin: 0 0 4px 0;
    }

    .product-name-en {
      color: #5f8f43;
      font-size: 25px;
      font-weight: 700;
      line-height: 1.12;
      margin: 0 0 10px 0;
      direction: ltr;
    }

    .product-desc {
      color: #ff1d1d;
      font-size: 15px;
      font-weight: 700;
      text-align: right;
      margin-bottom: 10px;
    }

    .product-desc.liquid {
      text-align: center;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 10px;
      font-size: 12px;
    }

    th, td {
      border: 1px solid #000;
      padding: 4px 6px;
      vertical-align: middle;
    }

    th {
      font-weight: 700;
    }

    .usage-table th,
    .usage-table td {
      text-align: center;
    }

    .text-right {
      text-align: right !important;
    }

    .warning-text {
      color: #ff1d1d;
      font-size: 13px;
      font-weight: 700;
      text-align: center;
      line-height: 1.35;
      margin: 8px 0 10px 0;
    }

    .reg-number {
      color: #4a8f2f;
      font-weight: 700;
      font-size: 13px;
      text-align: center;
      margin-top: 6px;
    }

    .reg-value {
      text-align: center;
      color: #4a8f2f;
      font-size: 14px;
      font-weight: 700;
      margin: 3px 0 10px 0;
      direction: ltr;
    }

    .footer-company {
      margin-top: 8px;
      font-size: 12px;
      line-height: 1.45;
    }

    .footer-company .label {
      color: #4a8f2f;
      font-weight: 700;
    }

    .logo-box {
      margin-top: 10px;
      text-align: center;
      min-height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 1px dashed #bbb;
      padding: 8px;
      overflow: hidden;
    }

    .logo-box img {
      max-width: 100%;
      max-height: 68px;
      object-fit: contain;
      display: block;
    }

    .logo-placeholder {
      color: #666;
      font-size: 13px;
      font-weight: 700;
    }

    .yellow-bar {
      position: absolute;
      right: 12px;
      left: 12px;
      bottom: 6px;
      height: 34px;
      background: #fff200;
    }

    .hidden-print {
      display: block;
    }

    @media print {
      body {
        background: #fff;
      }

      .hidden-print {
        display: none !important;
      }

      .app-wrap {
        padding: 0;
      }

      .preview-wrap {
        max-width: none;
        margin: 0;
        overflow: visible;
      }

      .sheet {
        width: 297mm;
        height: 210mm;
        box-shadow: none;
        margin: 0;
      }
    }
  </style>
</head>
<body>
  <div class="app-wrap">

    <div class="form-card hidden-print">
      <h1 class="form-title">إنشاء الملصق</h1>

      <div class="grid-2">
        <div class="field">
          <label for="trade_name_ar">اسم المبيد بالعربي</label>
          <input id="trade_name_ar" type="text" value="أكوكيم" placeholder="اسم المبيد بالعربي">
        </div>

        <div class="field">
          <label for="trade_name_en">اسم المبيد بالإنجليزي</label>
          <input id="trade_name_en" type="text" value="ACOCHEM" placeholder="اسم المبيد بالإنجليزي">
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="concentration">النسبة</label>
          <input id="concentration" type="text" value="25%" placeholder="النسبة">
        </div>

        <div class="field">
          <label for="formulation">هيئة المبيد</label>
          <select id="formulation"></select>
          <div class="field-note" id="formulation_note"></div>
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="pesticide_category">فئة المبيد</label>
          <select id="pesticide_category">
            <option value="insecticide" selected>مبيد حشري</option>
            <option value="acaricide">مبيد أكاروسي</option>
            <option value="fungicide">مبيد فطري</option>
            <option value="herbicide">مبيد أعشاب</option>
            <option value="nematicide">مبيد نيماتودي</option>
            <option value="growth_regulator">منظم نمو نباتي</option>
            <option value="molluscicide">مبيد قواقع</option>
            <option value="adjuvant">مادة مساعدة / ناشرة</option>
            <option value="attractant_repellent">مادة جاذبة / طاردة</option>
          </select>
        </div>

        <div class="field">
          <label for="group_text">رمز المجموعة</label>
          <input id="group_text" type="text" value="4A" placeholder="مثال: 4A">
        </div>
      </div>

      <div class="field">
        <label for="active_select">المادة الفعالة</label>
        <select id="active_select"></select>
        <div class="field-note">القائمة تحتوي الاسم العربي والإنجليزي</div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="registration_mode">حالة التسجيل</label>
          <select id="registration_mode">
            <option value="trial" selected>بدون رقم تسجيل للتجربة</option>
            <option value="registered">يوجد رقم تسجيل</option>
          </select>
        </div>

        <div class="field">
          <label for="registration_number">رقم التسجيل بالمملكة</label>
          <input id="registration_number" type="text" value="" placeholder="رقم التسجيل بالمملكة">
        </div>
      </div>

      <div class="grid-2">
        <div class="field">
          <label for="manufacturer">الشركة المنتجة</label>
          <input id="manufacturer" type="text" value="فابكو" placeholder="الشركة المنتجة">
        </div>

        <div class="field">
          <label for="agent">الوكيل الحصري / الموزعون</label>
          <input id="agent" type="text" value="التكامل الوطنية" placeholder="الوكيل الحصري / الموزعون">
        </div>
      </div>

      <div class="field">
        <label for="agent_logo">شعار الوكيل الحصري</label>
        <input id="agent_logo" type="file" accept="image/*">
        <div class="field-note">ارفع الشعار، وسيظهر مباشرة داخل النموذج</div>
      </div>

      <div class="btn-row">
        <button class="btn btn-generate" onclick="generateLabel()">إنشاء الملصق</button>
        <button class="btn btn-print" onclick="window.print()">طباعة / حفظ PDF</button>
      </div>
    </div>

    <div class="preview-wrap">
      <div class="sheet" id="labelSheet">
        <div class="columns">

          <!-- العمود الأيسر -->
          <div class="col col-left">
            <h3 class="section-title">قابلية الخلط:</h3>
            <p class="section-text" id="out_mixing_text"></p>

            <h3 class="section-title">التخزين:</h3>
            <p class="section-text" id="out_storage_text"></p>

            <h3 class="section-title">الأثر على الإنسان والبيئة والحيوان:</h3>
            <p class="section-text" id="out_effect_text"></p>

            <h3 class="section-title">أعراض التسمم:</h3>
            <p class="section-text" id="out_symptoms_text"></p>

            <h3 class="section-title">مضاد التسمم:</h3>
            <p class="section-text" id="out_antidote_text"></p>

            <h3 class="section-title">احتياطات:</h3>
            <div id="out_precautions_text"></div>

            <h3 class="section-title">التخلص من العبوات الفارغة:</h3>
            <p class="section-text" id="out_disposal_text"></p>

            <h3 class="section-title">الضمان:</h3>
            <p class="section-text" id="out_warranty_text"></p>

            <div class="yellow-bar"></div>
          </div>

          <!-- العمود الأوسط -->
          <div class="col col-middle">
            <h3 class="section-title">الخواص:</h3>
            <p class="section-text" id="out_properties_text"></p>

            <h3 class="section-title">معدل الاستخدام:</h3>
            <table class="usage-table">
              <tr>
                <th>المحصول</th>
                <th>الآفة</th>
                <th>المعدل</th>
                <th>فترة التحريم</th>
              </tr>
              <tr>
                <td class="text-right">الخضروات</td>
                <td>المن</td>
                <td>40 جم / 100 لتر</td>
                <td>7 أيام</td>
              </tr>
            </table>

            <h3 class="section-title">ملاحظة:</h3>
            <div id="out_note_text"></div>

            <h3 class="section-title">فترة إعادة الدخول للحقل المعامل:</h3>
            <p class="section-text" id="out_rei_text"></p>

            <div class="yellow-bar"></div>
          </div>

          <!-- العمود الأيمن -->
          <div class="col col-right">
            <div class="top-strip">
              <div class="cell light">GROUP</div>
              <div class="cell dark" id="out_group_value">4A</div>
              <div class="cell light" id="out_pesticide_type_text">INSECTICIDE</div>
            </div>

            <div id="product_name_wrap" class="product-name-wrap powder">
              <div class="product-name-ar" id="out_trade_name_ar">أكوكيم 25% دبليو بي</div>
              <div class="product-name-en" id="out_trade_name_en">ACOCHEM 25% WP</div>
            </div>

            <div class="product-desc" id="out_product_desc">
              مبيد حشري جهازي على هيئة مسحوق قابل للبلل (WP)
            </div>

            <h3 class="section-title">التركيب:</h3>
            <table>
              <tr>
                <th>التركيب:</th>
                <th>النسبة</th>
                <th>Ratio</th>
                <th>Composition</th>
              </tr>
              <tr>
                <td id="out_active_ar">إيميداكلوبريد</td>
                <td id="out_concentration_ar">25%</td>
                <td id="out_concentration_ratio">25%</td>
                <td id="out_active_en">Imidacloprid</td>
              </tr>
              <tr>
                <td>مواد مضافة</td>
                <td id="out_additives_ar">75%</td>
                <td id="out_additives_ratio">75%</td>
                <td>Additives</td>
              </tr>
              <tr>
                <td>المجموع</td>
                <td>100%</td>
                <td>100%</td>
                <td>Total</td>
              </tr>
            </table>

            <div class="warning-text">
              مبيد مقيد تحت إشراف فني مختص<br>
              يحفظ بعيداً عن متناول الأطفال
            </div>

            <h3 class="section-title">الإسعافات الأولية:</h3>
            <div id="out_first_aid_text"></div>

            <div class="reg-number">رقم التسجيل بالمملكة العربية السعودية</div>
            <div class="reg-value" id="out_registration_value">( - - - )</div>

            <table>
              <tr>
                <th>تاريخ الإنتاج</th>
                <th>تاريخ الانتهاء</th>
                <th>رقم الدفعة</th>
              </tr>
              <tr>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
                <td>&nbsp;</td>
              </tr>
            </table>

            <div class="footer-company">
              <div><span class="label">إنتاج:</span> <span id="out_manufacturer">فابكو</span></div>
              <div><span class="label">الوكيل والموزعون:</span> <span id="out_agent">التكامل الوطنية</span></div>
            </div>

            <div class="logo-box" id="logo_box">
              <span class="logo-placeholder">شعار الوكيل الحصري</span>
            </div>

            <div class="yellow-bar"></div>
          </div>

        </div>
      </div>
    </div>

  </div>

  <script>
    const FORMULATIONS = [
      {
        code: "CS",
        ar: "كبسولات معلقة",
        en: "Capsule suspension",
        def: "معلق ثابت من كبسولات في سائل تستخدم عادة بعد التخفيف بالماء.",
        type: "liquid"
      },
      {
        code: "DC",
        ar: "مركز قابل للانتشار",
        en: "Dispersible concentrate",
        def: "سائل متجانس لمادة صلبة قابلة للانتشار عند التخفيف.",
        type: "liquid"
      },
      {
        code: "DP",
        ar: "مسحوق تعفير",
        en: "Dustable powder",
        def: "مسحوق قابل للتعفير.",
        type: "powder"
      },
      {
        code: "EC",
        ar: "مركز قابل للاستحلاب",
        en: "Emulsifiable concentrate",
        def: "سائل متجانس يستخدم كمستحلب عند التخفيف بالماء.",
        type: "liquid"
      },
      {
        code: "EW",
        ar: "مستحلب زيت في الماء",
        en: "Emulsion oil in water",
        def: "سائل غير متجانس يحتوي على محلول المبيد في مذيب عضوي مكوناً كريات زيتية منتشرة في الوسط المائي.",
        type: "liquid"
      },
      {
        code: "FS",
        ar: "مركز انسيابي لمعاملة البذور",
        en: "Flowable concentrate for seed",
        def: "معلق ثابت لمعاملة البذور مباشرة أو بعد التخفيف بالماء.",
        type: "liquid"
      },
      {
        code: "GR",
        ar: "حبيبات",
        en: "Granules",
        def: "حبات صلبة انسيابية ذات مجال حجمي محدد للاستخدام المباشر.",
        type: "powder"
      },
      {
        code: "ME",
        ar: "مستحلب دقيق",
        en: "Micro emulsion",
        def: "مركز سائل رائق يحتوي على زيت وماء يستخدم مباشرة أو بعد التخفيف بالماء مكوناً مستحلباً دقيقاً أو مستحلباً عالياً.",
        type: "liquid"
      },
      {
        code: "OD",
        ar: "مركز زيتي قابل للانتشار",
        en: "Oil dispersion",
        def: "معلق ثابت للمادة الفعالة في سائل غير ممتزج بالماء وقد يحتوي على مواد فعالة أخرى وينتشر عند التخفيف بالماء.",
        type: "liquid"
      },
      {
        code: "SC",
        ar: "معلقة مركز",
        en: "Suspension concentrate",
        def: "معلق ثابت من المادة الفعالة يخفف بالماء عند الاستخدام.",
        type: "liquid"
      },
      {
        code: "SE",
        ar: "معلق مستحلب",
        en: "Suspo-emulsion",
        def: "سائل غير متجانس يحتوي على مادة فعالة منتشرة في صورة كريات في الوسط المائي.",
        type: "liquid"
      },
      {
        code: "SG",
        ar: "حبيبات قابلة للذوبان في الماء",
        en: "Water soluble granules",
        def: "مستحلب في صورة حبيبات تذوب في الماء مكونة محلولاً حقيقياً.",
        type: "powder"
      },
      {
        code: "SL",
        ar: "مركز قابل للذوبان",
        en: "Soluble concentrate",
        def: "سائل رائق متآلف يستخدم كمحلول حقيقي من المادة الفعالة بعد التخفيف بالماء.",
        type: "liquid"
      },
      {
        code: "SP",
        ar: "مسحوق قابل للذوبان في الماء",
        en: "Water soluble powder",
        def: "مسحوق قابل للذوبان في الماء عند الاستخدام.",
        type: "powder"
      },
      {
        code: "ST",
        ar: "أقراص قابلة للذوبان في الماء",
        en: "Water soluble tablets",
        def: "أقراص قابلة للذوبان في الماء تستخدم في صورة مكونة محلول مائي.",
        type: "powder"
      },
      {
        code: "UL",
        ar: "محلول رش متناهي الصغر",
        en: "Ultra low volume liquid",
        def: "محلول متجانس يستخدم بالات متخصصة في الرش متناهي الصغر.",
        type: "liquid"
      },
      {
        code: "WG",
        ar: "حبيبات قابلة للانتشار في الماء",
        en: "Water dispersible granules",
        def: "حبيبات تتفكك وتنتشر عند خلطها بالماء.",
        type: "powder"
      },
      {
        code: "WP",
        ar: "مسحوق قابل للبلل",
        en: "Wettable powder",
        def: "مسحوق يستخدم كمعلق بعد انتشاره في الماء.",
        type: "powder"
      },
      {
        code: "WS",
        ar: "مسحوق قابل للانتشار في الماء لمعاملة البذور",
        en: "Water dispersible powder for slurry seed treatment",
        def: "مسحوق ينتشر بتركيزات عالية في الماء قبل استخدامه على البذور في شكل عجينة.",
        type: "powder"
      },
      {
        code: "ZC",
        ar: "مستحضر مخلوط من كبسولات معلقة ومعلقات مركزة",
        en: "A mixed formulation of CS and SC",
        def: "معلق ثابت من كبسولات معلقة ومعلقات مركزة تستخدم بعد التخفيف بالماء.",
        type: "liquid"
      }
    ];

    const CATEGORY_META = {
      insecticide: {
        ar: "مبيد حشري",
        en: "INSECTICIDE",
        defaultGroup: "4A"
      },
      acaricide: {
        ar: "مبيد أكاروسي",
        en: "ACARICIDE",
        defaultGroup: ""
      },
      fungicide: {
        ar: "مبيد فطري",
        en: "FUNGICIDE",
        defaultGroup: ""
      },
      herbicide: {
        ar: "مبيد أعشاب",
        en: "HERBICIDE",
        defaultGroup: ""
      },
      nematicide: {
        ar: "مبيد نيماتودي",
        en: "NEMATICIDE",
        defaultGroup: ""
      },
      growth_regulator: {
        ar: "منظم نمو نباتي",
        en: "PLANT GROWTH REGULATOR",
        defaultGroup: ""
      },
      molluscicide: {
        ar: "مبيد قواقع",
        en: "MOLLUSCICIDE",
        defaultGroup: ""
      },
      adjuvant: {
        ar: "مادة مساعدة / ناشرة",
        en: "ADJUVANT",
        defaultGroup: ""
      },
      attractant_repellent: {
        ar: "مادة جاذبة / طاردة",
        en: "ATTRACTANT / REPELLENT",
        defaultGroup: ""
      }
    };

    const ACTIVE_INGREDIENTS = [
      { cat: "المبيدات الحشرية", en: "Acetamiprid", ar: "أسيتامبريد" },
      { cat: "المبيدات الحشرية", en: "Alfa-Cypermethrin", ar: "ألفا سايبرمثرين" },
      { cat: "المبيدات الحشرية", en: "Aluminium phosphide", ar: "فوسفيد الألومنيوم" },
      { cat: "المبيدات الحشرية", en: "Azadirachtin", ar: "أزادركتين" },
      { cat: "المبيدات الحشرية", en: "Bacillus Thuringiensis Kurstaki", ar: "باسيلس ثورينجينسيس كورستاكي" },
      { cat: "المبيدات الحشرية", en: "Bifenthrin", ar: "بايفنثرين" },
      { cat: "المبيدات الحشرية", en: "Bistrifluron", ar: "بايستريفليورين" },
      { cat: "المبيدات الحشرية", en: "Buprofezin", ar: "بيوبروفزين" },
      { cat: "المبيدات الحشرية", en: "Chlorantraniliprole", ar: "كلورانتزانيلبرول" },
      { cat: "المبيدات الحشرية", en: "Chlorfluazuron", ar: "كلورفلوازورون" },
      { cat: "المبيدات الحشرية", en: "Cyantraniliprole", ar: "سيانتزانيلبرول" },
      { cat: "المبيدات الحشرية", en: "Cypermethrin", ar: "سايبرمثرين" },
      { cat: "المبيدات الحشرية", en: "Cyromazine", ar: "سايرومازين" },
      { cat: "المبيدات الحشرية", en: "Deltamethrin", ar: "دلتامثرين" },
      { cat: "المبيدات الحشرية", en: "Diflubenzuron", ar: "دايفلوبنزيورون" },
      { cat: "المبيدات الحشرية", en: "Dinotefuran", ar: "داينوتيفوران" },
      { cat: "المبيدات الحشرية", en: "Emamectin Benzoate", ar: "إيمامكتين بنزوات" },
      { cat: "المبيدات الحشرية", en: "Esfenvalerate", ar: "اسفينفاليرات" },
      { cat: "المبيدات الحشرية", en: "Fenitrothion", ar: "فينتروثيون" },
      { cat: "المبيدات الحشرية", en: "Fenpropathrin", ar: "فينبروبارثرين" },
      { cat: "المبيدات الحشرية", en: "Fipronil", ar: "فيبرونيل" },
      { cat: "المبيدات الحشرية", en: "Flonicamid", ar: "فلونكاميد" },
      { cat: "المبيدات الحشرية", en: "Flometoquin", ar: "فلوميتوكين" },
      { cat: "المبيدات الحشرية", en: "Flupyradifurone", ar: "فلوبايراديفيورون" },
      { cat: "المبيدات الحشرية", en: "Fluxametamide", ar: "فلوكساميتاميد" },
      { cat: "المبيدات الحشرية", en: "Imidacloprid", ar: "إيميداكلوبريد" },
      { cat: "المبيدات الحشرية", en: "Indoxacarb", ar: "اندوكسكارب" },
      { cat: "المبيدات الحشرية", en: "Lambda cyhlothrin", ar: "لمبدا سيهالوثرين" },
      { cat: "المبيدات الحشرية", en: "Lufenuron", ar: "لوفينيورون" },
      { cat: "المبيدات الحشرية", en: "Matrine", ar: "ماترين" },
      { cat: "المبيدات الحشرية", en: "Metaflumizone", ar: "ميتافلوميزون" },
      { cat: "المبيدات الحشرية", en: "Methoxyfenozide", ar: "ميثوكسي فينوزيد" },
      { cat: "المبيدات الحشرية", en: "Paraffin-OIL", ar: "زيت معدني بارافيني" },
      { cat: "المبيدات الحشرية", en: "Pyrethrins", ar: "بايريثرنز" },
      { cat: "المبيدات الحشرية", en: "Pirimiphos methyl", ar: "بيريميفوس ميثيل" },
      { cat: "المبيدات الحشرية", en: "Pyridalyl", ar: "بايريداليل" },
      { cat: "المبيدات الحشرية", en: "Pyrifluquinazon", ar: "بيريفلوكوينازون" },
      { cat: "المبيدات الحشرية", en: "Pyriproxyfen", ar: "بايريبروكسيفين" },
      { cat: "المبيدات الحشرية", en: "Spinetoram", ar: "سبينتورام" },
      { cat: "المبيدات الحشرية", en: "Spinosad", ar: "سبينوساد" },
      { cat: "المبيدات الحشرية", en: "SPIROMESIFEN", ar: "سبيروميسيفين" },
      { cat: "المبيدات الحشرية", en: "Spirotetramat", ar: "سبيروتترامات" },
      { cat: "المبيدات الحشرية", en: "Sulfoxaflor", ar: "سلفوكسافلور" },
      { cat: "المبيدات الحشرية", en: "Thiamethoxam", ar: "ثياميثوكسام" },
      { cat: "المبيدات الحشرية", en: "Thiocyclam Hydrogen Oxalate", ar: "ثيوسكلام هيدروجيني أوكسالت" },
      { cat: "المبيدات الحشرية", en: "Tolfenpyrad", ar: "تولفينبيرد" },
      { cat: "المبيدات الحشرية", en: "Tebufenozide", ar: "تيبوفينوزيد" },
      { cat: "المبيدات الحشرية", en: "Thiamethoxam + Abamectin", ar: "ثياميثوكسام + أبامكتين" },
      { cat: "المبيدات الحشرية", en: "Methoxyfenozide + Spinetoram", ar: "ميثوكسي فينوزيد + سبينتورام" },
      { cat: "المبيدات الحشرية", en: "Bifenthrin + Abamectin", ar: "بايفنثرين + أبامكتين" },
      { cat: "المبيدات الحشرية", en: "Buprofezin + Deltamethrin", ar: "بيوبروفزين + دلتامثرين" },
      { cat: "المبيدات الحشرية", en: "Acetamiprid + Bistrifluron", ar: "أسيتامبريد + بايستريفليورين" },
      { cat: "المبيدات الحشرية", en: "Cyantraniliprole + Abamectin", ar: "سيانتزانيلبرول + أبامكتين" },
      { cat: "المبيدات الحشرية", en: "Imidacloprid + Bifenthrin", ar: "إيميداكلوبريد + بايفنثرين" },
      { cat: "المبيدات الحشرية", en: "Imidacloprid + Abamectin", ar: "إيميداكلوبريد + أبامكتين" },
      { cat: "المبيدات الحشرية", en: "Indoxacarb + Emamectin Benzoate", ar: "اندوكسكارب + إيمامكتين بنزوات" },
      { cat: "المبيدات الحشرية", en: "Pyriproxyfen + Emamectin Benzoate", ar: "بايريبروكسيفين + إيمامكتين بنزوات" },
      { cat: "المبيدات الحشرية", en: "Lufenuron + Emamectin Benzoate", ar: "لوفينورون + إيمامكتين بنزوات" },
      { cat: "المبيدات الحشرية", en: "Lambda-Cyhalothrin + Emamectin Benzoate", ar: "لمبدا سيهالوثرين + إيمامكتين بنزوات" },
      { cat: "المبيدات الحشرية", en: "Chlorantraniliprole + Abamectin", ar: "كلورانتزانيلبرول + أبامكتين" },
      { cat: "المبيدات الحشرية", en: "Chlorantraniliprole + LambdaCyhalothrin", ar: "كلورانتزانيلبرول + لمبدا سيهالوثرين" },
      { cat: "المبيدات الحشرية", en: "Thiamethoxam + Chlorantraniliprole", ar: "ثياميثوكسام + كلورانتزانيلبرول" },
      { cat: "المبيدات الحشرية", en: "Indoxacarb + Acetamiprid", ar: "اندوكسكارب + أسيتامبريد" },
      { cat: "المبيدات الحشرية", en: "Thiamethoxam + Lambda-Cyhalothrin", ar: "ثياميثوكسام + لمبدا سيهالوثرين" },

      { cat: "المبيدات الأكاروسية", en: "Abamectin", ar: "أبامكتين" },
      { cat: "المبيدات الأكاروسية", en: "Acequinocyl", ar: "أسيكوينوسيل" },
      { cat: "المبيدات الأكاروسية", en: "Acrinathrin", ar: "أكريناثرين" },
      { cat: "المبيدات الأكاروسية", en: "Bifenazate", ar: "بايفينزيت" },
      { cat: "المبيدات الأكاروسية", en: "Clofentezine", ar: "كلوفنتازين" },
      { cat: "المبيدات الأكاروسية", en: "Cyenopyrafen", ar: "سيينوبيرافن" },
      { cat: "المبيدات الأكاروسية", en: "Cyflumetofen", ar: "سيفلوميتوفن" },
      { cat: "المبيدات الأكاروسية", en: "Etoxazole", ar: "إيتوكسازول" },
      { cat: "المبيدات الأكاروسية", en: "Fenpyroximate", ar: "فينبايروكسيمات" },
      { cat: "المبيدات الأكاروسية", en: "Hexythiazox", ar: "هكسيثيازوكس" },
      { cat: "المبيدات الأكاروسية", en: "Milbemectin", ar: "ميلبمكتين" },
      { cat: "المبيدات الأكاروسية", en: "Pyridaben", ar: "بيريدابين" },
      { cat: "المبيدات الأكاروسية", en: "Bifenazate + Etoxazole", ar: "بايفينزيت + إيتوكسازول" },
      { cat: "المبيدات الأكاروسية", en: "Abamectin + Etoxazole", ar: "أبامكتين + إيتوكسازول" },
      { cat: "المبيدات الأكاروسية", en: "Abamectin + Bifenazate", ar: "أبامكتين + بايفينزيت" },

      { cat: "المبيدات الفطرية", en: "Azoxystrobin", ar: "أزوكسي ستروبين" },
      { cat: "المبيدات الفطرية", en: "Bacillus Subtilis (QST713)", ar: "باسيلس سبتلس (كيو اس تي 713)" },
      { cat: "المبيدات الفطرية", en: "Chinsol (8-hydroxyquinoline sulphate)", ar: "سينشول (8 كبريتات هيدروكسي كينولين)" },
      { cat: "المبيدات الفطرية", en: "Copper Hydroxide", ar: "هيدروكسيد النحاس" },
      { cat: "المبيدات الفطرية", en: "Copper Oxin", ar: "أوكسين النحاس" },
      { cat: "المبيدات الفطرية", en: "Copper Oxychloride", ar: "أوكسي كلوريد النحاس" },
      { cat: "المبيدات الفطرية", en: "Cyazofamid", ar: "سيازوفاميد" },
      { cat: "المبيدات الفطرية", en: "Difenoconazole", ar: "دايفينوكونازول" },
      { cat: "المبيدات الفطرية", en: "Fenpyrazamine", ar: "فينبيرازامين" },
      { cat: "المبيدات الفطرية", en: "Fenhexamid", ar: "فينهكساميد" },
      { cat: "المبيدات الفطرية", en: "Penthiopyrad", ar: "بنتيوبراد" },
      { cat: "المبيدات الفطرية", en: "Fludioxonil", ar: "فلوديوكسونيل" },
      { cat: "المبيدات الفطرية", en: "Flutianil", ar: "فلوتيانيل" },
      { cat: "المبيدات الفطرية", en: "Fosetyl Aluminum", ar: "فوسيتيل ألمنيوم" },
      { cat: "المبيدات الفطرية", en: "Hymexazol", ar: "هيمكسازول" },
      { cat: "المبيدات الفطرية", en: "Metalaxyl", ar: "ميتالاكسيل" },
      { cat: "المبيدات الفطرية", en: "Metalaxyl M", ar: "ميتالاكسيل إم" },
      { cat: "المبيدات الفطرية", en: "Metalaxyl M + COPPER HYDROXIDE", ar: "ميتالاكسيل إم + هيدروكسيد النحاس" },
      { cat: "المبيدات الفطرية", en: "Metrafenone", ar: "ميترافينون" },
      { cat: "المبيدات الفطرية", en: "Myclobutanil", ar: "ميكلوبوتانيل" },
      { cat: "المبيدات الفطرية", en: "Penconazole", ar: "بينكونازول" },
      { cat: "المبيدات الفطرية", en: "Prochloraz", ar: "بروكلوراز" },
      { cat: "المبيدات الفطرية", en: "Propamocarb HCL", ar: "بروياموكارب هيدروكلوريد" },
      { cat: "المبيدات الفطرية", en: "Propiconazole", ar: "بروبيكونازول" },
      { cat: "المبيدات الفطرية", en: "PYRIMETHANIL", ar: "بيريميثانيل" },
      { cat: "المبيدات الفطرية", en: "Spiroxamine", ar: "سبيروكسامين" },
      { cat: "المبيدات الفطرية", en: "SULFUR", ar: "كبريت" },
      { cat: "المبيدات الفطرية", en: "Tebuconazole", ar: "تيبوكونازول" },
      { cat: "المبيدات الفطرية", en: "Tolclofos–Methyl", ar: "تولكلوفوس – ميثيل" },
      { cat: "المبيدات الفطرية", en: "Triadimenol", ar: "ترياديمينول" },
      { cat: "المبيدات الفطرية", en: "Trifloxystrobin", ar: "ترايفلوكسستروبين" },
      { cat: "المبيدات الفطرية", en: "Pyraclostrobin + Boscalid", ar: "بيراكلوستروبين + بوسكاليد" },
      { cat: "المبيدات الفطرية", en: "Cymoxanil + Famoxadone", ar: "سايموكسانيل + فاموكسادون" },
      { cat: "المبيدات الفطرية", en: "Cymoxanil + Propamocarb HCL", ar: "سايموكسانيل + بروياموكارب هيدروكلوريد" },
      { cat: "المبيدات الفطرية", en: "Azoxystrobin + Cyproconazole", ar: "أزوكسيستروبين + سايبروكونازول" },
      { cat: "المبيدات الفطرية", en: "Azoxystrobin + Propiconazole", ar: "أزوكسيستروبين + بروبيكونازول" },
      { cat: "المبيدات الفطرية", en: "Difenoconazole + Metalaxyl M", ar: "دايفينوكونازول + ميتالاكسيل إم" },
      { cat: "المبيدات الفطرية", en: "Azoxystrobin + Difenoconazole", ar: "أزوكسيستروبين + دايفينوكونازول" },
      { cat: "المبيدات الفطرية", en: "Fluopyram + Trifloxystrobin", ar: "فلوبايرام + ترايفلوكسستروبين" },
      { cat: "المبيدات الفطرية", en: "Difenoconazole + Propiconazole", ar: "دايفينوكونازول + بروبيكونازول" },
      { cat: "المبيدات الفطرية", en: "Azoxystrobin + Metalaxyl M", ar: "أزوكسيستروبين + ميتالاكسيل إم" },
      { cat: "المبيدات الفطرية", en: "Mandipropamid + Difenoconazole", ar: "مانديبروياميد + دايفينوكونازول" },
      { cat: "المبيدات الفطرية", en: "Cyprodinil + Fludioxonil", ar: "سايبرودينيل + فلوديوكسونيل" },
      { cat: "المبيدات الفطرية", en: "Fosetyl Aluminum + Flumorph", ar: "فوسيتيل ألمنيوم + فلومورف" },
      { cat: "المبيدات الفطرية", en: "Dimethomorph + Pyraclostrobin", ar: "دايمثومورف + بيراكلوستروبين" },
      { cat: "المبيدات الفطرية", en: "Metalaxyl + Copper Oxychloride", ar: "ميتالاكسيل + أوكسي كلوريد النحاس" },
      { cat: "المبيدات الفطرية", en: "Benalaxyl + Copper Oxychloride", ar: "بينالاكسيل + أوكسي كلوريد النحاس" },
      { cat: "المبيدات الفطرية", en: "Fosetyl Aluminum + Propamocarb", ar: "فوسيتيل ألمنيوم + بروباموكارب" },
      { cat: "المبيدات الفطرية", en: "Cymoxanil + Copper Oxychloride", ar: "سايموكسانيل + أوكسي كلوريد النحاس" },
      { cat: "المبيدات الفطرية", en: "Pydiflumetofen (Adepidyn) + Difenoconazole", ar: "بايديفلوميتوفين (أديبيدين) + دايفينوكونازول" },
      { cat: "المبيدات الفطرية", en: "OXATHIAPIPROLIN + Famoxadone", ar: "أوكساثيابيرولين + فاموكسادون" },
      { cat: "المبيدات الفطرية", en: "Dimethomorph + Cymoxanil", ar: "دايمثومورف + سايموكسانيل" },
      { cat: "المبيدات الفطرية", en: "Mandipropamid + OXATHIAPIPROLIN", ar: "مانديبروياميد + أوكساثيابيرولين" },

      { cat: "المبيدات العشبية", en: "Aclonifen", ar: "اكلونيفين" },
      { cat: "المبيدات العشبية", en: "BENTAZONE", ar: "بنتازون" },
      { cat: "المبيدات العشبية", en: "Bromoxynil Octanoate", ar: "بروموكسينيل أوكتانويت" },
      { cat: "المبيدات العشبية", en: "Clethodim", ar: "كلثوديم" },
      { cat: "المبيدات العشبية", en: "Clomazone", ar: "كلومازون" },
      { cat: "المبيدات العشبية", en: "Cycloxydim", ar: "سيكلوكسيديم" },
      { cat: "المبيدات العشبية", en: "Diquat Dibromide", ar: "دايكوات دايبروماديد" },
      { cat: "المبيدات العشبية", en: "Florasulam", ar: "فلوراسولام" },
      { cat: "المبيدات العشبية", en: "Fluazifop-P-Butyl", ar: "فلوازيفوب – بي – بيويتيل" },
      { cat: "المبيدات العشبية", en: "FLUMETSULAM", ar: "فلوميتسولام" },
      { cat: "المبيدات العشبية", en: "GLUFOSINATE - AMMONIUM", ar: "جلوفوسينيت أمونيوم" },
      { cat: "المبيدات العشبية", en: "Glyphosate", ar: "جليفوسيت" },
      { cat: "المبيدات العشبية", en: "IMAZAMOX", ar: "إيمازاموكس" },
      { cat: "المبيدات العشبية", en: "Imazethapyr", ar: "إيمازيثابير" },
      { cat: "المبيدات العشبية", en: "Mesosulfuron-methyl + lodosulfuron-methyl-sodium", ar: "ميزوسلفيورون ميثيل + أيودوسلفيورون ميثيل صوديوم" },
      { cat: "المبيدات العشبية", en: "Metribuzin", ar: "ميتريبوزين" },
      { cat: "المبيدات العشبية", en: "Nicosulfuron", ar: "نيكوسلفورون" },
      { cat: "المبيدات العشبية", en: "Rimsulfuron", ar: "ريمسلفورون" },
      { cat: "المبيدات العشبية", en: "Pendimethalin", ar: "بنديميثالين" },
      { cat: "المبيدات العشبية", en: "Pinoxaden", ar: "بينوكسادين" },
      { cat: "المبيدات العشبية", en: "PROMETRYN", ar: "بروميترين" },
      { cat: "المبيدات العشبية", en: "Prodiamine", ar: "بروديامين" },
      { cat: "المبيدات العشبية", en: "Prosulfocarb", ar: "بروسلفوكارب" },
      { cat: "المبيدات العشبية", en: "PYROXASULFONE", ar: "بيروكساسلفون" },
      { cat: "المبيدات العشبية", en: "Quizalofop-P-ethyl", ar: "كويزالوفوب – بي – إيثيل" },
      { cat: "المبيدات العشبية", en: "SULFENTRAZONE", ar: "سولفينترازون" },
      { cat: "المبيدات العشبية", en: "S-METOLACHLOR", ar: "إس ميتولاكلور" },
      { cat: "المبيدات العشبية", en: "Tribenuron Methyl", ar: "ترايبينورون ميثيل" },
      { cat: "المبيدات العشبية", en: "Bromoxynil Octanoate + Diflufenican", ar: "بروموكسينيل أوكتانويت + ديفلوفينكان" },

      { cat: "المبيدات النيماتودية", en: "Cinnamaldehyde", ar: "سينمالدهيد" },
      { cat: "المبيدات النيماتودية", en: "Fluopyram", ar: "فلوبايرام" },
      { cat: "المبيدات النيماتودية", en: "Fosthiazate", ar: "فوسثيازيت" },
      { cat: "المبيدات النيماتودية", en: "Imicyafos", ar: "إميسيافوس" },
      { cat: "المبيدات النيماتودية", en: "Oxamyl", ar: "أوكساميل" },
      { cat: "المبيدات النيماتودية", en: "Metam-potassium", ar: "ميتام بوتاسيوم" },

      { cat: "منظمات النمو النباتية", en: "Chlorpropham", ar: "كلوربروفام" },
      { cat: "منظمات النمو النباتية", en: "Trinexapac ethyl", ar: "ترينيكساباك إيثل" },
      { cat: "منظمات النمو النباتية", en: "1-naphthyl acetic acid (1-NAA) + gibberellic acid + Glycine", ar: "حمض نفثيل أسيتيك + حمض الجبريليك + جلايسين" },
      { cat: "منظمات النمو النباتية", en: "1-naphthyl acetic acid (1-NAA) + 1-naphthyl acetamide", ar: "حمض نفثيل أسييد + نفثيل أستاميد" },
      { cat: "منظمات النمو النباتية", en: "gibberellic acid", ar: "حمض الجبريليك" },

      { cat: "مبيدات القواقع", en: "Metaldehyde", ar: "ميتالدهيد" },

      { cat: "المواد المساعدة والناشرة", en: "Alcohol Ethoxylat, AlkylPhenol Ethoxylate", ar: "الكيل الكحول إيثوكسيلات" },
      { cat: "المواد المساعدة والناشرة", en: "polyether Polysiloxane", ar: "بولي إيثر بولي سيلوكسـان" },
      { cat: "المواد المساعدة والناشرة", en: "Glycol Ethoxylate + Polydimethylsiloxane", ar: "جلايكول إيثوكسيلات + ثنائي ميثيل سيليوگزان" },

      { cat: "المواد الجاذبة والطاردة", en: "Hydrolysed proteins", ar: "البروتينات المتحللة بالماء" },
      { cat: "المواد الجاذبة والطاردة", en: "(E,Z,Z)-3,8,11-Tetradecatrienyl acetate", ar: "(إي زد زد) 3,8,11-تتراديكاترينيـل أسيتات" },
      { cat: "المواد الجاذبة والطاردة", en: "(3E;8Z;11Z)-3,8-tetradecatrien-1-yl acetate and (3E,8Z tetradecadien-1-yl acetate), (E,Z)-3,8-tetradecatrienyl acetate", ar: "(3E;8Z;11Z)-3,8 تترديكاترين 1-يل أسيتات و (3E,8Z تترديكادين-1-يل أسيتات) , (E,Z)-3,8 تترديكاترينيل أسيتات" },
      { cat: "المواد الجاذبة والطاردة", en: "(3E;8Z;11Z)-3,8-tetradecatrien-1-yl acetate and (3E,8Z tetradecadien-1-yl acetate), (E,Z)-3,8-tetradecatrienyl acetate +", ar: "(3E;8Z;11Z)-3,8 تترديكاترين 1-يل أسيتات و (3E,8Z تترديكادين-1-يل أسيتات) + ..." },
      { cat: "المواد الجاذبة والطاردة", en: "4-Methyl-5-Nonanol + 4-Methyl-5-Nonanone", ar: "4 ميثيل -5 نونانول + 4 ميثيل -5 نونانون" }
    ];

    const STATIC_CONTENT = {
      mixing: "يمكن خلطه مع عدد من المبيدات المناسبة ويجب الرش مباشرة بعد الخلط، ويفضل عمل تجربة مصغرة قبل الخلط بكميات كبيرة.",
      storage: "يحفظ في عبواته الأصلية محكمة الإغلاق في مكان جاف جيد التهوية بعيداً عن مصادر الحرارة وأشعة الشمس المباشرة وبعيداً عن متناول الأطفال وبعيداً عن المواد الغذائية والأعلاف والبذور والأسمدة.",
      effect: "يجب تجنب ملامسة المبيد للعين أو الجلد أو استنشاقه، كما يجب عدم تلويث مصادر المياه أو تعريض الكائنات غير المستهدفة للمبيد.",
      symptoms: "قد تظهر أعراض تسمم بحسب نوع التعرض وتركيز المادة الفعالة، ويجب التعامل الطبي الفوري عند الاشتباه بالتسمم.",
      antidote: "لا توجد جرعة مضادة محددة بشكل عام، ويتم العلاج حسب الأعراض الظاهرة وتوجيهات الطبيب.",
      precautions: `• اتبع التعليمات المدونة على بطاقة المعلومات بدقة.
• ارتدِ الملابس الواقية عند خلط المبيد أو استخدامه.
• تجنب استنشاق أبخرة أو غبار المبيد.
• لا تأكل أو تشرب أو تدخن أثناء الاستخدام.
• اغسل الجسم والملابس الواقية جيداً بعد الاستخدام.`,
      disposalPowder: "يمنع منعاً باتاً إعادة استخدام عبوات المبيد الفارغة لأي غرض كان، ويتم التخلص منها في الحاويات المخصصة لذلك وفق التعليمات المعتمدة.",
      disposalLiquid: "يجب غسل العبوة ثلاث مرات وإفراغها في خزان الرش وعدم إعادة استخدامها لأي غرض، ثم التخلص منها في الحاويات المخصصة لذلك.",
      warranty: "تضمن الشركة المنتج في عبواته الأصلية وذلك تحت ظروف التخزين المناسبة، ولا تتحمل أي أضرار ناتجة عن سوء التخزين أو الاستخدام.",
      firstAid: `• في حالة ملامسته العينين: تغسل فوراً بالماء النظيف لمدة 15 دقيقة على الأقل.
• في حالة ملامسته للجلد: تنزع الملابس الملوثة وتغسل أجزاء الجسم جيداً بالماء والصابون.
• في حالة الاستنشاق: ينقل المصاب إلى منطقة جيدة التهوية بعيداً عن مكان التلوث ويستدعى الطبيب.
• في حالة ابتلاع المبيد: يعطى المصاب 1 – 2 كأس من الماء حسب الإرشادات الطبية.
• في حالة التعرض للمبيد الاتصال على الرقم الموحد لوزارة الصحة 937.`,
      note: `• يجب إجراء تجربة مصغرة قبل الاستخدام الواسع عند الحاجة.
• يراعى إدخال المبيد ضمن برنامج مكافحة متكاملة والتبادل مع المبيدات الأخرى عند تكرار الاستخدام.`,
      rei: "12 ساعة"
    };

    const logoInput = document.getElementById("agent_logo");
    let logoDataUrl = "";

    function initFormulations() {
      const select = document.getElementById("formulation");
      select.innerHTML = FORMULATIONS.map(f =>
        `<option value="${f.code}" ${f.code === "WP" ? "selected" : ""}>${f.code} — ${f.ar} — ${f.en}</option>`
      ).join("");
      updateFormulationNote();
    }

    function updateFormulationNote() {
      const code = document.getElementById("formulation").value;
      const f = FORMULATIONS.find(x => x.code === code);
      const note = document.getElementById("formulation_note");
      if (!f) {
        note.textContent = "";
        return;
      }
      note.textContent = `${f.ar} | ${f.en} | ${f.def}`;
    }

    function initActiveIngredients() {
      const select = document.getElementById("active_select");
      const groups = {};

      ACTIVE_INGREDIENTS.forEach(item => {
        if (!groups[item.cat]) groups[item.cat] = [];
        groups[item.cat].push(item);
      });

      let html = "";
      Object.keys(groups).forEach(cat => {
        html += `<optgroup label="${cat}">`;
        groups[cat].forEach(item => {
          const value = encodeURIComponent(JSON.stringify(item));
          const selected = item.en === "Imidacloprid" ? "selected" : "";
          html += `<option value="${value}" ${selected}>${item.ar} — ${item.en}</option>`;
        });
        html += `</optgroup>`;
      });

      select.innerHTML = html;
    }

    function escapeHtml(text) {
      return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    }

    function textToListOrParagraphs(text) {
      const safe = escapeHtml(text);
      const lines = safe.split("\n").filter(line => line.trim() !== "");
      if (!lines.length) return "";

      const allBullets = lines.every(line => line.trim().startsWith("•"));
      if (allBullets) {
        const items = lines.map(line => {
          const cleaned = line.replace(/^•\s*/, "").trim();
          return `<li>${cleaned}</li>`;
        }).join("");
        return `<ul class="section-list">${items}</ul>`;
      }

      return lines.map(line => `<p class="section-text">${line}</p>`).join("");
    }

    function getValue(id) {
      return document.getElementById(id).value.trim();
    }

    function getSelectedActive() {
      const raw = document.getElementById("active_select").value;
      try {
        return JSON.parse(decodeURIComponent(raw));
      } catch {
        return { en: "", ar: "" };
      }
    }

    function getSelectedFormulation() {
      const code = document.getElementById("formulation").value;
      return FORMULATIONS.find(f => f.code === code);
    }

    function getArabicFormulationLabel(code) {
      const f = FORMULATIONS.find(x => x.code === code);
      return f ? f.ar : code;
    }

    function isPowderType(code) {
      const f = FORMULATIONS.find(x => x.code === code);
      return f ? f.type === "powder" : true;
    }

    function updateRegistrationState() {
      const mode = document.getElementById("registration_mode").value;
      const input = document.getElementById("registration_number");
      input.disabled = mode !== "registered";
      if (mode !== "registered") input.value = "";
    }

    function updateCategoryDefaults() {
      const key = document.getElementById("pesticide_category").value;
      const meta = CATEGORY_META[key];
      if (!meta) return;
      document.getElementById("group_text").value = document.getElementById("group_text").value || meta.defaultGroup;
    }

    function buildProductDescription(categoryKey, formulationCode) {
      const cat = CATEGORY_META[categoryKey] || CATEGORY_META.insecticide;
      const formulationAr = getArabicFormulationLabel(formulationCode);
      return `${cat.ar} على هيئة ${formulationAr} (${formulationCode})`;
    }

    function generateLabel() {
      const tradeNameAr = getValue("trade_name_ar");
      const tradeNameEn = getValue("trade_name_en");
      const concentration = getValue("concentration");
      const formulation = getValue("formulation");
      const active = getSelectedActive();
      const registrationMode = getValue("registration_mode");
      const registrationNumber = getValue("registration_number");
      const manufacturer = getValue("manufacturer");
      const agent = getValue("agent");
      const groupText = getValue("group_text");
      const categoryKey = getValue("pesticide_category");
      const formulationInfo = getSelectedFormulation();
      const categoryMeta = CATEGORY_META[categoryKey] || CATEGORY_META.insecticide;

      const formLabelAr = getArabicFormulationLabel(formulation);
      const finalNameAr = `${tradeNameAr} ${concentration} ${formLabelAr}`.trim();
      const finalNameEn = `${tradeNameEn} ${concentration} ${formulation}`.trim();
      const productDesc = buildProductDescription(categoryKey, formulation);

      let regValue = "( - - - )";
      if (registrationMode === "registered" && registrationNumber) {
        regValue = registrationNumber;
      }

      const parsedPercent = parseFloat(concentration.replace("%", "").trim());
      let additives = "—";
      if (!isNaN(parsedPercent)) {
        additives = `${Math.max(0, 100 - parsedPercent)}%`;
      }

      const powder = isPowderType(formulation);
      const productWrap = document.getElementById("product_name_wrap");
      const productDescEl = document.getElementById("out_product_desc");

      productWrap.className = `product-name-wrap ${powder ? "powder" : "liquid"}`;
      productDescEl.className = `product-desc ${powder ? "" : "liquid"}`.trim();

      document.getElementById("out_group_value").textContent = groupText.replace("GROUP", "").trim();
      document.getElementById("out_pesticide_type_text").textContent = categoryMeta.en;

      document.getElementById("out_trade_name_ar").textContent = finalNameAr;
      document.getElementById("out_trade_name_en").textContent = finalNameEn;
      document.getElementById("out_product_desc").textContent = productDesc;

      document.getElementById("out_active_ar").textContent = active.ar || active.en;
      document.getElementById("out_concentration_ar").textContent = concentration;
      document.getElementById("out_concentration_ratio").textContent = concentration;
      document.getElementById("out_active_en").textContent = active.en || "";
      document.getElementById("out_additives_ar").textContent = additives;
      document.getElementById("out_additives_ratio").textContent = additives;

      const dynamicProperties = formulationInfo
        ? `${categoryMeta.ar} ${formulationInfo.def}`
        : `${categoryMeta.ar} على هيئة ${formLabelAr} (${formulation})`;

      document.getElementById("out_properties_text").textContent = dynamicProperties;
      document.getElementById("out_mixing_text").textContent = STATIC_CONTENT.mixing;
      document.getElementById("out_storage_text").textContent = STATIC_CONTENT.storage;
      document.getElementById("out_effect_text").textContent = STATIC_CONTENT.effect;
      document.getElementById("out_symptoms_text").textContent = STATIC_CONTENT.symptoms;
      document.getElementById("out_antidote_text").textContent = STATIC_CONTENT.antidote;
      document.getElementById("out_disposal_text").textContent = powder ? STATIC_CONTENT.disposalPowder : STATIC_CONTENT.disposalLiquid;
      document.getElementById("out_warranty_text").textContent = STATIC_CONTENT.warranty;
      document.getElementById("out_rei_text").textContent = STATIC_CONTENT.rei;

      document.getElementById("out_precautions_text").innerHTML = textToListOrParagraphs(STATIC_CONTENT.precautions);
      document.getElementById("out_note_text").innerHTML = textToListOrParagraphs(STATIC_CONTENT.note);
      document.getElementById("out_first_aid_text").innerHTML = textToListOrParagraphs(STATIC_CONTENT.firstAid);

      document.getElementById("out_registration_value").textContent = regValue;
      document.getElementById("out_manufacturer").textContent = manufacturer;
      document.getElementById("out_agent").textContent = agent;

      const logoBox = document.getElementById("logo_box");
      if (logoDataUrl) {
        logoBox.innerHTML = `<img src="${logoDataUrl}" alt="Agent Logo">`;
      } else {
        logoBox.innerHTML = `<span class="logo-placeholder">شعار الوكيل الحصري</span>`;
      }
    }

    logoInput.addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        logoDataUrl = "";
        generateLabel();
        return;
      }

      const reader = new FileReader();
      reader.onload = function (e) {
        logoDataUrl = e.target.result;
        generateLabel();
      };
      reader.readAsDataURL(file);
    });

    document.getElementById("formulation").addEventListener("change", function () {
      updateFormulationNote();
      generateLabel();
    });

    document.getElementById("registration_mode").addEventListener("change", function () {
      updateRegistrationState();
      generateLabel();
    });

    document.getElementById("pesticide_category").addEventListener("change", function () {
      generateLabel();
    });

    initFormulations();
    initActiveIngredients();
    updateRegistrationState();
    generateLabel();
  </script>
</body>
</html>
