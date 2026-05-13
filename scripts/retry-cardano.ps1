$students = Get-Content C:\Users\Ahmed\Desktop\identus\apps\issuer-api\data\students.json | ConvertFrom-Json

foreach ($s in $students) {
  $creds = if ($s.issuedCredentials) { $s.issuedCredentials } else { @() }
  foreach ($c in $creds) {
    if (-not $c.walletConfirmedAt -or $c.cardanoTxHash) { continue }

    Write-Host "Processing: $($s.name) | $($c.degree)..."

    $issuingDid = if ($c.issuingDid) { $c.issuingDid } else { "did:prism:unknown" }
    $issuedAt   = if ($c.issuedAt)   { $c.issuedAt }   else { (Get-Date -Format "o") }
    $degree     = if ($c.degree)     { $c.degree }      else { "" }
    $gradDate   = if ($c.graduationDate) { $c.graduationDate } else { "" }
    $uniName    = if ($c.universityName) { $c.universityName } else { "" }
    $studentId  = if ($s.studentNumber) { $s.studentNumber } else { $s.id }

    $vc = @{
      "@context"         = @("https://www.w3.org/2018/credentials/v1")
      id                 = "urn:credential:$($c.credentialRecordId)"
      type               = @("VerifiableCredential", "DiplomaCredential2022")
      issuer             = $issuingDid
      issuanceDate       = $issuedAt
      credentialSubject  = @{
        degree         = $degree
        graduationDate = $gradDate
        gpa            = $c.gpa
        studentId      = $studentId
        studentName    = $s.name
        universityName = $uniName
        universityDid  = $issuingDid
      }
    }

    $body = @{ vc = $vc } | ConvertTo-Json -Depth 10

    try {
      $r = Invoke-RestMethod -Uri "http://localhost:3002/api/cardano/write-vc-hash" -Method POST -ContentType "application/json" -Body $body
      Write-Host "  OK  -> txHash: $($r.txHash)"
      Write-Host "         url:    $($r.cardanoscanUrl)"
      Write-Host "  Waiting 30s for block confirmation before next write..."
      Start-Sleep -Seconds 30
    } catch {
      Write-Host "  ERR -> $($_.ErrorDetails.Message)"
      Write-Host "  Waiting 30s before next attempt..."
      Start-Sleep -Seconds 30
    }
  }
}

Write-Host "Done."
