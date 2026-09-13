from pathlib import Path
import win32com.client, json, os, zipfile, unicodedata, xml.etree.ElementTree as ET
out=Path(os.environ.get('RAAVI_WORD_OUTPUT', 'outputs/rem-02')).resolve()
w=win32com.client.DispatchEx('Word.Application')
w.Visible=False
w.DisplayAlerts=0
w.AutomationSecurity=3
d=None
try:
 d=w.Documents.Open(str(out/'academic-formulas.docx'),ConfirmConversions=False,ReadOnly=False,AddToRecentFiles=False,Visible=False)
 before=d.OMaths.Count
 expected=len(json.loads((out/'support-matrix.json').read_text(encoding='utf-8'))['samples'])
 assert before == expected, f'Expected {expected} editable equations, received {before}'
 d.ExportAsFixedFormat(str(out/'academic-formulas.pdf'),17,OpenAfterExport=False)
 # Editing one equation in a disposable copy verifies the native edit surface survives opening.
 equation=d.OMaths.Item(1)
 equation.Range.Text='x+2'
 equation.BuildUp()
 d.SaveAs2(str(out/'academic-formulas-edited.docx'),16)
 result={'equationsBefore':before,'equationsAfterEdit':d.OMaths.Count,'firstEquationAfterEdit':d.OMaths.Item(1).Range.Text,'pages':d.ComputeStatistics(2),'wordVersion':w.Version}
 assert result['equationsAfterEdit'] == expected, 'Editing lost native equations'
 # Word's live math Range uses styled Unicode (e.g. mathematical italic x).
 # Check its normalized meaning and the exact persisted native equation.
 assert unicodedata.normalize('NFKC',result['firstEquationAfterEdit']) == 'x+2', 'Live equation edit was not preserved'
 with zipfile.ZipFile(out/'academic-formulas-edited.docx') as archive:
  root=ET.fromstring(archive.read('word/document.xml'))
 ns={'m':'http://schemas.openxmlformats.org/officeDocument/2006/math'}
 equations=root.findall('.//m:oMath',ns)
 result['firstSavedEquation']=''.join(equations[0].itertext())
 assert len(equations) == expected, 'Saved file lost native equations'
 assert result['firstSavedEquation'] == 'x+2', 'Saved equation edit was not preserved'
 (out/'word-render-result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(result,ensure_ascii=True))
finally:
 if d is not None:d.Close(SaveChanges=0)
 w.Quit(SaveChanges=0)
