$backendRoot = 'C:\Users\dylan\Documents\knots_backend'
$controllerPath = Join-Path $backendRoot 'src/main/java/com/knots/backend/controllers/ExperimentsController.java'
$controller = [IO.File]::ReadAllText($controllerPath).Replace('public void startExperiment(@RequestBody List<Long> knotIds)', 'public Long startExperiment(@RequestBody List<Long> knotIds)').Replace('        experimentsService.startExperiment(knotIds);', '        return experimentsService.startExperiment(knotIds);')
[IO.File]::WriteAllText($controllerPath, $controller)
$servicePath = Join-Path $backendRoot 'src/main/java/com/knots/backend/services/ExperimentsService.java'
$service = [IO.File]::ReadAllText($servicePath).Replace('public void startExperiment(List<Long> knotIds)', 'public Long startExperiment(List<Long> knotIds)').Replace('        experimentsRepo.save(experiment);', '        experiment = experimentsRepo.save(experiment);').Replace('        experimentsFNRepo.saveAll(efnList);' + "`r`n    }", '        experimentsFNRepo.saveAll(efnList);' + "`r`n        return experimentId;`r`n    }")
[IO.File]::WriteAllText($servicePath, $service)
$requestPath = Join-Path $backendRoot 'src/main/java/com/knots/backend/models/dtos/experiments/MoveRequest.java'
$request = [IO.File]::ReadAllText($requestPath).Replace('import com.knots.backend.models.dtos.MoveType;', "import com.knots.backend.models.dtos.MoveType;`r`nimport com.fasterxml.jackson.annotation.JsonSubTypes;`r`nimport com.fasterxml.jackson.annotation.JsonTypeInfo;").Replace('public interface MoveRequest', '@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, property = "type")' + "`r`n" + '@JsonSubTypes(@JsonSubTypes.Type(value = AddTwistRequest.class, name = "addTwist"))' + "`r`npublic interface MoveRequest")
[IO.File]::WriteAllText($requestPath, $request)
$locationPath = Join-Path $backendRoot 'src/main/java/com/knots/backend/services/LocationSpecifyingService.java'
$location = [IO.File]::ReadAllText($locationPath).Replace('        return intersectPotentialStrandLists(potentialStrandLists);', '        if (potentialStrandLists.isEmpty()) return new ArrayList<>(orientedStrands.keySet());' + "`r`n        return intersectPotentialStrandLists(potentialStrandLists);")
[IO.File]::WriteAllText($locationPath, $location)
